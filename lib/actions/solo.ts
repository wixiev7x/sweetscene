"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { rateLimit } from "@/lib/utils/ratelimit";
import { scrubInjection, sanitizeMessage } from "@/lib/utils/safety";
import { buildSystemPrompt, parseExampleDialog } from "@/lib/ai/prompts";
import { getProvider } from "@/lib/ai";
import type { AIMessage } from "@/lib/ai/provider";

/* ════════════════════════════════════════════════════════════════════
 * Phase 3 — Solo play persistence + character ratings.
 *
 * Every function is a server action: auth.getUser() first, rate-limit
 * on AI-generating calls, defer to getProvider() for completions so
 * the mock fallback keeps the app demoable with zero API keys.
 * ════════════════════════════════════════════════════════════════════ */

/** One entry inside the solo_session.messages JSONB array. */
type SoloMessage = {
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

/** Subset of character fields the play page needs for display. */
type CharacterInfo = {
  id: string;
  name: string;
  user_prompt: string;
  scenario_tags: string[];
  is_nsfw: boolean;
  alternate_greetings_count: number;
  avatar_url: string | null;
};

/** Full character data resolved from JSON defaults or the DB. */
type ResolvedCharacter = {
  id: string;
  name: string;
  user_prompt: string;
  system_prompt: string;
  scenario_tags: string[];
  is_nsfw: boolean;
  first_message: string | null;
  example_dialog: string | null;
  alternate_greetings: string[];
  avatar_url: string | null;
};

type SessionResult = {
  sessionId: string;
  messages: SoloMessage[];
  character: CharacterInfo;
  tokensUsed: number;
} | { error: string };

type AppendResult = {
  content: string;
  tokensUsed: number;
} | { error: string };

type SimpleResult = { success: true } | { error: string };

type RegenerateResult = { success: true; greeting: string } | { error: string };

type RecentSession = {
  id: string;
  character_id: string;
  character_name: string;
  character_avatar_url: string | null;
  message_count: number;
  last_message_preview: string;
  updated_at: string;
};

type RecentSessionsResult = { sessions: RecentSession[] } | { error: string };

const MAX_MESSAGES = 50;

/**
 * Resolves a character by ID from the characters table. The
 * system_prompt column is REVOKED from authenticated users, so it's
 * fetched separately via the admin (service-role) client. All other
 * columns come from the regular client (RLS-enforced: public or owned).
 * Returns null when the character is not visible to the caller.
 */
async function resolveCharacter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  characterId: string
): Promise<ResolvedCharacter | null> {
  /* Safe columns via the user's session (RLS-enforced). */
  const { data } = await supabase
    .from("characters")
    .select(
      "id, name, user_prompt, scenario_tags, is_nsfw, first_message, example_dialog, alternate_greetings, avatar_url"
    )
    .eq("id", characterId)
    .single();

  if (!data) return null;

  /* system_prompt via the admin client (REVOKED from authenticated). */
  const admin = createAdminClient();
  const { data: promptRow } = await admin
    .from("characters")
    .select("system_prompt")
    .eq("id", characterId)
    .single();

  const systemPrompt =
    (promptRow as { system_prompt: string | null } | null)?.system_prompt ??
    (data.user_prompt as string);

  return {
    id: data.id as string,
    name: data.name as string,
    user_prompt: data.user_prompt as string,
    system_prompt: systemPrompt,
    scenario_tags: (data.scenario_tags as string[]) ?? [],
    is_nsfw: (data.is_nsfw as boolean) ?? false,
    first_message: (data.first_message as string) ?? null,
    example_dialog: (data.example_dialog as string) ?? null,
    alternate_greetings: (data.alternate_greetings as string[]) ?? [],
    avatar_url: (data.avatar_url as string) ?? null,
  };
}

/**
 * Converts a ResolvedCharacter to the slim CharacterInfo shape the
 * client needs for display (no system_prompt leaks to the browser).
 */
function toCharacterInfo(char: ResolvedCharacter): CharacterInfo {
  return {
    id: char.id,
    name: char.name,
    user_prompt: char.user_prompt,
    scenario_tags: char.scenario_tags,
    is_nsfw: char.is_nsfw,
    alternate_greetings_count: char.alternate_greetings.length,
    avatar_url: char.avatar_url,
  };
}

/**
 * Creates a new solo play session for the given character. If the
 * character has a first_message, it is inserted as the opening
 * assistant turn so the user walks into a greeting.
 */
export async function startSoloSession(
  characterId: string
): Promise<SessionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const char = await resolveCharacter(supabase, characterId);
  if (!char) return { error: "Character not found" };

  const now = new Date().toISOString();
  const initialMessages: SoloMessage[] = [];

  if (char.first_message && char.first_message.trim()) {
    initialMessages.push({
      role: "assistant",
      content: char.first_message,
      created_at: now,
    });
  }

  const { data: session, error } = await supabase
    .from("solo_sessions")
    .insert({
      user_id: user.id,
      character_id: characterId,
      messages: initialMessages,
      tokens_used: 0,
    })
    .select("id, messages, tokens_used")
    .single();

  if (error || !session) return { error: "Failed to create session" };

  return {
    sessionId: session.id as string,
    messages: (session.messages as SoloMessage[]) ?? [],
    character: toCharacterInfo(char),
    tokensUsed: (session.tokens_used as number) ?? 0,
  };
}

/**
 * Creates a waiting-room solo session — a free, is_waiting=true chat
 * with a random public character. Spawned during matchmaking so the
 * user has zero dead time while waiting for a human partner. Deleted
 * when the user enters the matched scene (or the 45s timer expires
 * and an AI match is created instead).
 */
export async function startWaitingRoomSession(): Promise<SessionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  /* Pick a random public character for the waiting room. */
  const { data: randomChars } = await supabase
    .from("characters")
    .select("id")
    .eq("visibility", "public")
    .limit(50);

  if (!randomChars || randomChars.length === 0) {
    return { error: "No characters available for the waiting room" };
  }

  const pick =
    randomChars[Math.floor(Math.random() * randomChars.length)];
  const charId = pick.id as string;

  const char = await resolveCharacter(supabase, charId);
  if (!char) return { error: "Character not found" };

  const now = new Date().toISOString();
  const initialMessages: SoloMessage[] = [];

  if (char.first_message && char.first_message.trim()) {
    initialMessages.push({
      role: "assistant",
      content: char.first_message,
      created_at: now,
    });
  }

  const { data: session, error } = await supabase
    .from("solo_sessions")
    .insert({
      user_id: user.id,
      character_id: charId,
      is_waiting: true,
      messages: initialMessages,
      tokens_used: 0,
    })
    .select("id, messages, tokens_used")
    .single();

  if (error || !session) return { error: "Failed to create waiting room" };

  return {
    sessionId: session.id as string,
    messages: (session.messages as SoloMessage[]) ?? [],
    character: toCharacterInfo(char),
    tokensUsed: (session.tokens_used as number) ?? 0,
  };
}

/**
 * Resumes the most recent solo session for the given character, or
 * creates a new one if none exists. Used by /play/[id] on mount.
 */
export async function getOrCreateSoloSession(
  characterId: string
): Promise<SessionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("solo_sessions")
    .select("id, messages, tokens_used")
    .eq("user_id", user.id)
    .eq("character_id", characterId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const char = await resolveCharacter(supabase, characterId);
    if (!char) return { error: "Character not found" };

    return {
      sessionId: existing.id as string,
      messages: (existing.messages as SoloMessage[]) ?? [],
      character: toCharacterInfo(char),
      tokensUsed: (existing.tokens_used as number) ?? 0,
    };
  }

  return startSoloSession(characterId);
}

/**
 * Loads a specific solo session by ID. Used when resuming from the
 * "Continue chatting" carousel on /characters.
 */
export async function continueSoloSession(
  sessionId: string
): Promise<SessionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: session } = await supabase
    .from("solo_sessions")
    .select("id, character_id, messages, tokens_used")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return { error: "Session not found" };

  const char = await resolveCharacter(supabase, session.character_id as string);
  if (!char) return { error: "Character not found" };

  return {
    sessionId: session.id as string,
    messages: (session.messages as SoloMessage[]) ?? [],
    character: toCharacterInfo(char),
    tokensUsed: (session.tokens_used as number) ?? 0,
  };
}

/**
 * Appends a user message + AI response to a solo session. Builds the
 * full AI message array (system prompt + example-dialog priming +
 * scrubbed history), calls getProvider().generate(), persists both
 * turns to the JSONB, and enforces the 50-entry sliding cap.
 */
export async function appendSoloMessage(
  sessionId: string,
  content: string
): Promise<AppendResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down. The director is thinking." };
  }

  const { data: session } = await supabase
    .from("solo_sessions")
    .select("id, character_id, messages, tokens_used, is_waiting")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return { error: "Session not found" };

  const char = await resolveCharacter(supabase, session.character_id as string);
  if (!char) return { error: "Character not found" };

  /* S17/M8: waiting-room sessions are capped at 30 user messages so
     the free waiting-room chat doesn't become an unlimited AI
     substitute. Regular solo sessions keep the 50-entry cap. */
  const currentMsgs = (session.messages as SoloMessage[]) ?? [];
  const userMsgCount = currentMsgs.filter((m) => m.role === "user").length;
  if (session.is_waiting === true && userMsgCount >= 30) {
    return { error: "Waiting room limit reached — enter your match or start an AI scene" };
  }

  const scrubbed = scrubInjection(content);
  const now = new Date().toISOString();

  const currentMessages = (session.messages as SoloMessage[]) ?? [];
  const userMessage: SoloMessage = { role: "user", content: scrubbed, created_at: now };
  const allMessages = [...currentMessages, userMessage];

  const fullSystemPrompt = buildSystemPrompt(
    { system_prompt: char.system_prompt, user_prompt: char.user_prompt },
    char.is_nsfw
  );

  const aiMessages: AIMessage[] = [{ role: "system", content: fullSystemPrompt }];

  const exampleMessages = parseExampleDialog(char.example_dialog);
  for (const ex of exampleMessages) {
    aiMessages.push({ role: ex.role, content: ex.content });
  }

  for (const m of allMessages) {
    if (m.role === "user") {
      aiMessages.push({ role: "user", content: scrubInjection(m.content) });
    } else {
      aiMessages.push({ role: "assistant", content: m.content });
    }
  }

  const provider = getProvider();
  const aiResult = await provider.generate(aiMessages, {
    maxTokens: 200,
    temperature: 0.9,
  });

  if ("error" in aiResult) return { error: aiResult.error };

  /* S11: sanitize AI output before storing — same as getSoloPlayResponse.
     Scrub injection patterns + redact PII so the AI can't reflect them. */
  const aiText = scrubInjection(sanitizeMessage(aiResult.content));
  const aiMessage: SoloMessage = {
    role: "assistant",
    content: aiText,
    created_at: new Date().toISOString(),
  };

  let newMessages = [...allMessages, aiMessage];
  if (newMessages.length > MAX_MESSAGES) {
    newMessages = newMessages.slice(newMessages.length - MAX_MESSAGES);
  }

  const estimatedTokens = provider.estimateTokens(aiText);
  const newTokensUsed = (session.tokens_used as number) + estimatedTokens;

  /* Column REVOKE on (tokens_used, messages) means we must use the
     update_solo_session SECURITY DEFINER RPC to write both columns. */
  const { error: updateError } = await supabase.rpc("update_solo_session", {
    p_session_id: sessionId,
    p_messages: newMessages,
    p_tokens_used: newTokensUsed,
  });

  if (updateError) return { error: "Failed to save message" };

  return { content: aiText, tokensUsed: estimatedTokens };
}

/**
 * Deletes a solo session. Called by the "Clear Chat" button on the
 * play page — the caller then starts a fresh session.
 */
export async function deleteSoloSession(sessionId: string): Promise<SimpleResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("solo_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to delete session" };

  return { success: true };
}

/**
 * Fetches the caller's most recent solo sessions across all
 * characters, with character name / avatar for the "Continue
 * chatting" carousel on /characters.
 */
export async function getRecentSessions(
  limit = 5
): Promise<RecentSessionsResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: sessions } = await supabase
    .from("solo_sessions")
    .select("id, character_id, messages, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!sessions) return { sessions: [] };

  const result: RecentSession[] = [];

  for (const s of sessions) {
    const char = await resolveCharacter(supabase, s.character_id as string);
    const msgs = (s.messages as SoloMessage[]) ?? [];
    const lastMsg = msgs[msgs.length - 1];

    result.push({
      id: s.id as string,
      character_id: s.character_id as string,
      character_name: char?.name ?? "Unknown",
      character_avatar_url: char?.avatar_url ?? null,
      message_count: msgs.length,
      last_message_preview: lastMsg?.content?.slice(0, 80) ?? "",
      updated_at: s.updated_at as string,
    });
  }

  return { sessions: result };
}

/**
 * Submits a thumbs-up / thumbs-down rating for a character. Upserts
 * on (character_id, user_id) so each user rates each character once.
 * The touch_connection_score trigger recalculates connection_score
 * automatically.
 */
export async function submitCharacterRating(
  characterId: string,
  liked: boolean
): Promise<SimpleResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down" };
  }

  const { error } = await supabase.from("character_ratings").upsert(
    {
      character_id: characterId,
      user_id: user.id,
      liked,
    },
    { onConflict: "character_id,user_id" }
  );

  if (error) return { error: "Failed to submit rating" };

  return { success: true };
}

/**
 * Swaps the opening greeting of a solo session to the next
 * alternate_greeting. Only allowed when the session has no user
 * messages yet (the opener is the only assistant turn).
 */
export async function regenerateGreeting(
  sessionId: string,
  greetingIndex: number
): Promise<RegenerateResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: session } = await supabase
    .from("solo_sessions")
    .select("id, character_id, messages, tokens_used")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return { error: "Session not found" };

  const char = await resolveCharacter(supabase, session.character_id as string);
  if (!char) return { error: "Character not found" };

  if (char.alternate_greetings.length === 0) {
    return { error: "No alternate greetings available" };
  }

  const idx = greetingIndex % char.alternate_greetings.length;
  const greeting = char.alternate_greetings[idx];

  const currentMessages = (session.messages as SoloMessage[]) ?? [];
  const hasUserMessages = currentMessages.some((m) => m.role === "user");
  if (hasUserMessages) {
    return { error: "Can only regenerate greeting on an empty session" };
  }

  let newMessages: SoloMessage[];
  if (currentMessages.length > 0 && currentMessages[0].role === "assistant") {
    newMessages = [
      { role: "assistant", content: greeting, created_at: new Date().toISOString() },
      ...currentMessages.slice(1),
    ];
  } else {
    newMessages = [
      { role: "assistant", content: greeting, created_at: new Date().toISOString() },
      ...currentMessages,
    ];
  }

  /* Column REVOKE on (messages) means we use the update_solo_session
     RPC. Pass the unchanged tokens_used so it's not modified. */
  const sessionTokens = (session.tokens_used as number) ?? 0;
  const { error } = await supabase.rpc("update_solo_session", {
    p_session_id: sessionId,
    p_messages: newMessages,
    p_tokens_used: sessionTokens,
  });

  if (error) return { error: "Failed to update greeting" };

  return { success: true, greeting };
}
