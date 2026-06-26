"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { rateLimit } from "@/lib/utils/ratelimit";
import { scrubInjection } from "@/lib/utils/safety";
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
 * Messages are encrypted at rest — this action decrypts them server-side
 * when building the AI context, then encrypts the AI response before
 * inserting. The system_prompt is read via the admin client (service role)
 * because the column is REVOKED from authenticated users.
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

  const { data: recentMessages } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(12);

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

  if ("error" in aiResult) {
    return { error: "AI response failed" };
  }

  const aiText: string = aiResult.content;
  const estimatedTokens = provider.estimateTokens(aiText);

  /* Insert the AI message via the admin client — the messages INSERT
     RLS policy only allows sender_type='human', so AI messages need
     the service role to bypass RLS. Content is encrypted at rest. */
  const insertPayload = {
    match_id: matchId,
    sender_type: "ai",
    sender_id: null,
    character_id: characterId,
    content: encryptMessage(aiText),
    tokens_used: estimatedTokens,
  };
  await admin.from("messages").insert(insertPayload as never).then();

  const newPool = match.shared_pool - estimatedTokens;
  const updateData: Record<string, unknown> = {
    ai_turn_due: false,
    human_message_count: 0,
    shared_pool: newPool,
    last_activity: new Date().toISOString(),
  };

  if (newPool <= 0) {
    updateData.status = "ended";
    updateData.ended_at = new Date().toISOString();
  }

  await supabase.from("matches").update(updateData).eq("id", matchId);

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

  return {
    content: aiResult.content,
    tokensUsed: provider.estimateTokens(aiResult.content),
  };
}

type TurnstileResult = { success: boolean } | { error: string };

/**
 * Verifies a Cloudflare Turnstile token. Returns { success: true }
 * only when the token is valid. When no TURNSTILE_SECRET_KEY is
 * configured (e.g. local dev), verification is skipped and the
 * login proceeds — so the app works without a Turnstile site key.
 */
export async function verifyTurnstile(token: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) return { success: true };

  if (!token) return { error: "Captcha required" };

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret,
          response: token,
        }),
      }
    );

    const data = await res.json();
    if (data?.success === true) return { success: true };
    return { error: data?.["error-codes"]?.[0] ?? "Captcha failed" };
  } catch {
    return { error: "Captcha verification failed" };
  }
}
