"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { rateLimit } from "@/lib/utils/ratelimit";
import { scrubInjection, sanitizeMessage } from "@/lib/utils/safety";
import { encryptMessage, decryptMessage } from "@/lib/utils/crypto";
import { buildSystemPrompt, parseExampleDialog } from "@/lib/ai/prompts";
import { getProvider } from "@/lib/ai";
import type { AIMessage } from "@/lib/ai/provider";

type AIResponseResult =
  | { content: string; characterId: string }
  | { error: string };

/**
 * Generates an AI response for the given match. Handles character selection,
 * secret prompt wrapping, provider call, encrypted message insertion, and
 * token pool accounting.
 *
 * Phase 5a changes:
 *   - claim_ai_turn RPC atomically flips ai_turn_due before the AI call,
 *     preventing double-fire (H6).
 *   - apply_ai_turn RPC atomically inserts the AI message + updates the
 *     match (pool, counter, status), replacing the server-side
 *     matches.update that broke after the column REVOKE (C5).
 *   - Context window bumped to 20 (A1) with rolling summary every 10
 *     messages cached on matches.context_summary (A2).
 *   - AI output is sanitized before encrypt+insert (S11).
 *   - On AI error with a configured provider, inserts a graceful
 *     "The character hesitates…" message instead of surfacing the error (A6).
 */
export async function generateAIResponse(
  matchId: string
): Promise<AIResponseResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down. The director is thinking." };
  }

  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (!match) return { error: "Match not found" };
  if (match.user_a !== user.id && match.user_b !== user.id) {
    return { error: "Match not found" };
  }

  if (!match.ai_turn_due || match.status !== "active") {
    return { error: "Not AI turn" };
  }

  /* H6: atomically claim the AI turn. If another caller already won
     the race, claim_ai_turn returns NULL and we abort. The RPC
     flips ai_turn_due to false + returns the current shared_pool. */
  const { data: claimData } = await supabase.rpc("claim_ai_turn", {
    p_match_id: matchId,
  });

  if (!claimData || !Array.isArray(claimData) || claimData.length === 0) {
    return { error: "AI turn already in progress" };
  }

  const { data: recentMessages } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(20);

  const chatHistory = (recentMessages ?? []).reverse();

  const characterIds: string[] = match.character_ids ?? [];
  if (characterIds.length === 0) {
    return { error: "No AI characters in match" };
  }

  const charIndex = match.human_message_count % characterIds.length;
  const characterId = characterIds[charIndex];

  /* Read system_prompt via the admin client — the column is REVOKED
     from authenticated so browser queries can't extract it. */
  const admin = createAdminClient();
  const { data: dbCharRaw } = await admin
    .from("characters")
    .select("system_prompt, user_prompt, is_nsfw")
    .eq("id", characterId)
    .single();

  const dbChar = dbCharRaw as
    | { system_prompt: string | null; user_prompt: string; is_nsfw: boolean | null }
    | null;

  let systemPrompt: string;
  let userPrompt: string;
  let isNSFW: boolean;

  if (dbChar) {
    systemPrompt = dbChar.system_prompt ?? dbChar.user_prompt;
    userPrompt = dbChar.user_prompt;
    isNSFW = dbChar.is_nsfw ?? false;
  } else {
    systemPrompt = "You are a helpful AI character.";
    userPrompt = "You are a helpful AI character.";
    isNSFW = false;
  }

  const fullSystemPrompt = buildSystemPrompt(
    { system_prompt: systemPrompt, user_prompt: userPrompt },
    isNSFW
  );

  const messages: AIMessage[] = [
    { role: "system", content: fullSystemPrompt },
  ];

  /* A2: rolling summary — when the context is full (20 messages),
     prepend a cheap summary of the oldest messages so the AI retains
     story continuity without sending the full history every turn.
     The summary is cached on matches.context_summary and refreshed
     every 10 messages to save tokens. */
  if (
    chatHistory.length >= 20 &&
    match.human_message_count > 0 &&
    match.human_message_count % 10 === 0
  ) {
    /* Build a summary of the oldest 14 messages. */
    const toSummarize = chatHistory.slice(0, 14);
    const summaryParts: string[] = [];
    for (const msg of toSummarize) {
      let plaintext = "";
      try {
        plaintext = decryptMessage(msg.content as string);
      } catch {
        plaintext = "";
      }
      const role = msg.sender_type === "human" ? "Human" : "AI";
      summaryParts.push(`${role}: ${plaintext}`);
    }

    const summaryPrompt: AIMessage[] = [
      {
        role: "system",
        content:
          "Summarise the following roleplay scene in 2-3 sentences. Keep it concise and focused on the key events and emotional beats. Output ONLY the summary.",
      },
      { role: "user", content: summaryParts.join("\n") },
    ];

    const provider = getProvider();
    const summaryResult = await provider.generate(summaryPrompt, {
      maxTokens: 100,
      temperature: 0.5,
      model: "deepseek-chat",
    });

    if ("content" in summaryResult) {
      const summaryText = `Story so far: ${summaryResult.content}`;
      messages.push({ role: "system", content: summaryText });

      /* Cache the summary on the match row. */
      await admin
        .from("matches")
        .update({ context_summary: summaryResult.content } as never)
        .eq("id", matchId)
        .then();
    }
  } else if (match.context_summary) {
    /* Use the cached summary if one exists and we didn't just refresh. */
    messages.push({
      role: "system",
      content: `Story so far: ${match.context_summary}`,
    });
  }

  /* Decrypt message content before building the AI context. Each
     message's content is AES-256-GCM encrypted at rest. */
  for (const msg of chatHistory) {
    let plaintext = "";
    try {
      plaintext = decryptMessage(msg.content as string);
    } catch {
      plaintext = "";
    }

    if (msg.sender_type === "human") {
      messages.push({ role: "user", content: scrubInjection(plaintext) });
    } else if (msg.sender_type === "ai") {
      messages.push({ role: "assistant", content: plaintext });
    }
  }

  const provider = getProvider();
  const aiResult = await provider.generate(messages, {
    maxTokens: 150,
    temperature: 0.9,
  });

  /* A6: graceful refusal — if the provider is configured but returned
     an error, insert a silent in-character placeholder instead of
     surfacing a red error to the user. Only the server knows the
     provider failed; the client sees the AI "hesitate". */
  let aiText: string;
  if ("error" in aiResult) {
    if (!provider.isConfigured()) {
      /* Provider not configured AND mock returned an error — shouldn't
         happen, but return the error so the caller can handle it. */
      return { error: "AI not configured" };
    }
    aiText = "The character hesitates and falls silent for a moment…";
  } else {
    /* S11: sanitize AI output before storing. The AI may reflect
       prompt-injection patterns or PII from the conversation —
       scrub both before encrypt+insert. */
    aiText = scrubInjection(sanitizeMessage(aiResult.content));
  }

  const estimatedTokens = provider.estimateTokens(aiText);
  const encryptedText = encryptMessage(aiText);

  /* C5/H6/F1: apply_ai_turn RPC atomically inserts the AI message +
     computes the new pool server-side (p_new_pool is NOT accepted as a
     parameter — the RPC reads shared_pool with FOR UPDATE and subtracts
     p_tokens_used). This RPC is service_role-only — called via the admin
     client so no authenticated user can call it directly to inject fake
     AI messages or manipulate the pool. */
  const { data: applyResult } = await admin.rpc("apply_ai_turn", {
    p_match_id: matchId,
    p_encrypted_text: encryptedText,
    p_character_id: characterId,
    p_tokens_used: estimatedTokens,
    p_caller_id: user.id,
  } as never);

  if (!applyResult || !Array.isArray(applyResult) || (applyResult as unknown[]).length === 0) {
    return { error: "Failed to apply AI turn" };
  }

  return { content: aiText, characterId };
}

type SoloMessage = { role: "user" | "assistant"; content: string };

type SoloPlayResult =
  | { content: string; tokensUsed: number }
  | { error: string };

/**
 * Server-side AI call for the solo-play page (/play/[id]). The API key
 * is server-only. The system_prompt is read via the admin client
 * (column-level restricted from authenticated). Solo sessions are NOT
 * encrypted — the admin can inspect them for AI behaviour debugging.
 *
 * Phase 5a: H7 — verifies the caller can see the character (public,
 * unlisted, or owned) before reading system_prompt via the admin
 * client. Prevents any user from using a private character's prompt.
 */
export async function getSoloPlayResponse(
  characterId: string,
  history: SoloMessage[]
): Promise<SoloPlayResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down. The director is thinking." };
  }

  /* H7: visibility check via the USER client (RLS-enforced). The
     character must be public, unlisted, or owned by the caller.
     This runs BEFORE the admin read so a private character's
     system_prompt is never exposed to a non-owner. */
  const { data: visibleChar } = await supabase
    .from("characters")
    .select("id")
    .eq("id", characterId)
    .maybeSingle();

  if (!visibleChar) return { error: "Character not found" };

  /* Read system_prompt via the admin client — REVOKED from authenticated. */
  const admin = createAdminClient();
  const { data: dbCharRaw } = await admin
    .from("characters")
    .select("system_prompt, user_prompt, is_nsfw, example_dialog")
    .eq("id", characterId)
    .single();

  const dbChar = dbCharRaw as
    | {
        system_prompt: string | null;
        user_prompt: string;
        is_nsfw: boolean | null;
        example_dialog: string | null;
      }
    | null;

  if (!dbChar) return { error: "Character not found" };

  const systemPrompt = dbChar.system_prompt ?? dbChar.user_prompt;
  const isNSFW = dbChar.is_nsfw ?? false;
  const exampleDialog = dbChar.example_dialog ?? null;

  const fullSystemPrompt = buildSystemPrompt(
    { system_prompt: systemPrompt, user_prompt: systemPrompt },
    isNSFW
  );

  const sanitizedHistory: SoloMessage[] = history.map((m) =>
    m.role === "user" ? { ...m, content: scrubInjection(m.content) } : m
  );

  const messages: AIMessage[] = [
    { role: "system", content: fullSystemPrompt },
  ];

  const exampleMessages = parseExampleDialog(exampleDialog);
  for (const ex of exampleMessages) {
    messages.push({ role: ex.role, content: ex.content });
  }

  messages.push(...sanitizedHistory);

  const provider = getProvider();
  const aiResult = await provider.generate(messages, {
    maxTokens: 200,
    temperature: 0.9,
  });

  if ("error" in aiResult) return { error: aiResult.error };

  /* S11: sanitize AI output. */
  const sanitizedContent = scrubInjection(sanitizeMessage(aiResult.content));

  return {
    content: sanitizedContent,
    tokensUsed: provider.estimateTokens(sanitizedContent),
  };
}

type TurnstileResult = { success: boolean } | { error: string };

/**
 * Actions for the AI turn trigger system.
 */

type NudgeResult = { success: true } | { error: string };

/**
 * Flips ai_turn_due to true when a human message directly addresses a
 * character by name (A3). Wraps the request_direct_turn SECURITY
 * DEFINER RPC — server-side gated to participants + active match +
 * ai_turn_due currently false.
 */
export async function requestDirectAITurn(
  matchId: string
): Promise<NudgeResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("request_direct_turn", {
    p_match_id: matchId,
  });

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { error: "Failed" };
  }

  return { success: true };
}

/**
 * Silent AI nudge after 15 seconds of human inactivity (A4). Wraps the
 * request_ai_nudge SECURITY DEFINER RPC — the RPC itself checks that
 * now() - last_human_message_at > 15s so a client can't force-spam
 * the AI. If the nudge fires, Realtime broadcasts the ai_turn_due flip
 * and the chat page's AI-turn effect calls generateAIResponse.
 */
export async function requestAINudge(
  matchId: string
): Promise<NudgeResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("request_ai_nudge", {
    p_match_id: matchId,
  });

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { error: "Failed" };
  }

  return { success: true };
}

/**
 * Verifies a Cloudflare Turnstile token. Returns { success: true }
 * only when the token is valid. When no TURNSTILE_SECRET_KEY is
 * configured in development, verification is skipped. In production
 * with no key, verification fails-closed (S6).
 */
export async function verifyTurnstile(token: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    /* S6: fail-closed in production, skip in development. */
    if (process.env.NODE_ENV === "production") {
      return { error: "Captcha not configured" };
    }
    return { success: true };
  }

  if (!token) return { error: "Captcha required" };

  try {
    const verifyUrl =
      process.env.TURNSTILE_VERIFY_URL ||
      "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    const res = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
      }),
    });

    const data = await res.json();
    if (data?.success === true) return { success: true };
    return { error: data?.["error-codes"]?.[0] ?? "Captcha failed" };
  } catch {
    return { error: "Captcha verification failed" };
  }
}