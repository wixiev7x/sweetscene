"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { encryptMessage, decryptMessage } from "@/lib/utils/crypto";
import { sanitizeAndScrub, containsBlockedTerm } from "@/lib/utils/safety";
import { rateLimit } from "@/lib/utils/ratelimit";

/* ════════════════════════════════════════════════════════════════════
 * Phase 4.5 — Encrypted message actions.
 *
 * All matched-chat and DM messages flow through these server actions.
 * Message content is encrypted at rest (AES-256-GCM) so the database
 * admin cannot read user conversations. Only reported chats are
 * decrypted and snapshotted into the reports table for moderation.
 *
 * Solo sessions (1-on-1 AI practice) are NOT encrypted — the admin
 * can inspect those for AI behaviour debugging.
 * ════════════════════════════════════════════════════════════════════ */

type DecryptedMessage = {
  id: string;
  match_id: string;
  sender_type: "human" | "ai";
  sender_id: string | null;
  character_id: string | null;
  content: string;
  tokens_used: number;
  created_at: string;
};

type SendMessageResult =
  | { messageId: string; content: string }
  | { error: string };

type GetMessagesResult =
  | { messages: DecryptedMessage[] }
  | { error: string };

type DecryptResult = { content: string } | { error: string };

type ReportResult = { success: true } | { error: string };

/**
 * Encrypts and inserts a human message into the messages table.
 * The caller's identity is verified via auth.getUser() before any
 * DB work. Content is sanitized, scrubbed, and encrypted server-side.
 *
 * Returns the plaintext content so the sender can display it
 * optimistically without needing to decrypt their own message.
 */
export async function sendMessage(
  matchId: string,
  content: string
): Promise<SendMessageResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (containsBlockedTerm(content)) {
    return { error: "Message blocked" };
  }

  const scrubbed = sanitizeAndScrub(content);
  if (!scrubbed.trim()) {
    return { error: "Empty message" };
  }

  const encrypted = encryptMessage(scrubbed);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      match_id: matchId,
      sender_type: "human",
      sender_id: user.id,
      character_id: null,
      content: encrypted,
      tokens_used: Math.ceil(scrubbed.length / 4),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Failed to send message" };
  }

  return { messageId: data.id, content: scrubbed };
}

/**
 * Fetches all messages for a match and decrypts their content.
 * RLS ensures only participants can read the rows — the decrypt
 * step happens server-side so the key never reaches the browser.
 */
export async function getMatchMessages(
  matchId: string
): Promise<GetMessagesResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: rows } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  if (!rows) return { messages: [] };

  const decrypted: DecryptedMessage[] = rows.map((msg) => {
    let content = "";
    try {
      content = decryptMessage(msg.content as string);
    } catch {
      /* Tampered or corrupted data — show a placeholder. */
      content = "[unreadable]";
    }

    return {
      id: msg.id as string,
      match_id: msg.match_id as string,
      sender_type: msg.sender_type as "human" | "ai",
      sender_id: (msg.sender_id as string) ?? null,
      character_id: (msg.character_id as string) ?? null,
      content,
      tokens_used: (msg.tokens_used as number) ?? 0,
      created_at: msg.created_at as string,
    };
  });

  return { messages: decrypted };
}

/**
 * Decrypts a single message's encrypted content. Used by the Realtime
 * handler on the chat/DM pages — when a new message arrives via
 * Realtime, its content is encrypted, so the client calls this action
 * to get the plaintext for display.
 *
 * Verifies the caller is a participant of the match before decrypting.
 */
export async function decryptMessageContent(
  matchId: string,
  encryptedContent: string
): Promise<DecryptResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  /* Verify the caller is a participant of this match. */
  const { data: match } = await supabase
    .from("matches")
    .select("id")
    .eq("id", matchId)
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .single();

  if (!match) return { error: "Not authorized" };

  try {
    return { content: decryptMessage(encryptedContent) };
  } catch {
    return { error: "Failed to decrypt" };
  }
}

/**
 * Reports a conversation. Decrypts all messages in the match and
 * stores them as an evidence_snapshot in the reports table. Only the
 * admin (service_role) can read reports — users cannot.
 *
 * This is the ONLY way the admin can read matched-chat content:
 * through a user-initiated report. Privacy by default.
 */
export async function reportConversation(
  matchId: string,
  reason: string
): Promise<ReportResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down" };
  }

  if (!reason.trim()) {
    return { error: "Reason required" };
  }

  /* Fetch all messages for the match (RLS: participants only). */
  const { data: rows } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  if (!rows) {
    return { error: "No messages to report" };
  }

  /* Decrypt the evidence snapshot. */
  const evidence = rows.map((msg) => {
    let content = "";
    try {
      content = decryptMessage(msg.content as string);
    } catch {
      content = "[unreadable]";
    }
    return {
      sender_type: msg.sender_type,
      sender_id: msg.sender_id,
      content,
      created_at: msg.created_at,
    };
  });

  /* Insert the report. RLS allows INSERT by self only. No SELECT
     policy for authenticated — only service_role can read. */
  const { error: insertError } = await supabase.from("reports").insert({
    reporter_id: user.id,
    match_id: matchId,
    reason: reason.trim(),
    evidence_snapshot: evidence,
  });

  if (insertError) {
    return { error: "Failed to file report" };
  }

  return { success: true };
}
