"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { encryptMessage, decryptMessage } from "@/lib/utils/crypto";
import { sanitizeAndScrub } from "@/lib/utils/safety";
import { moderateText } from "@/lib/utils/moderation";
import { rateLimit } from "@/lib/utils/ratelimit";
import { assertNotBanned } from "@/lib/utils/ban";
import { notifyNewDM } from "@/lib/notifications/dispatch";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/config/constants";
import { logger } from "@/lib/utils/logger";

/* ════════════════════════════════════════════════════════════════════
 * Phase 5a — Encrypted message actions with RPC-backed mutations.
 *
 * All matched-chat and DM messages flow through these server actions.
 * Message content is encrypted at rest (AES-256-GCM) so the database
 * admin cannot read user conversations. Only reported chats are
 * decrypted and snapshotted into the reports table for moderation.
 *
 * Phase 5a changes:
 *   - sendMessage wraps send_human_message RPC (C1/H1/M2/M6).
 *   - getMatchMessages adds cursor pagination (M9).
 *   - decryptMessageContent verifies ciphertext belongs to the match (M1).
 *   - reportConversation wraps report_conversation RPC (M5).
 *   - Rate limiting on sendMessage and decrypt (H8/H9).
 *
 * Phase 7:
 *   - sendDMMessage wraps sendMessage + verifies match.status='revealed'
 *     server-side (closes H4 — DM access guard was client-only) + refuses
 *     media/attachment URL patterns (no images/voice/video in DMs).
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
  | { messageId: string; content: string; humanMessageCount: number; aiTurnDue: boolean }
  | { error: string };

type GetMessagesResult =
  | { messages: DecryptedMessage[]; hasMore: boolean }
  | { error: string };

type DecryptResult = { content: string } | { error: string };

type ReportResult = { success: true } | { error: string };

const MAX_MESSAGE_LENGTH = 4000; /* reports can be longer than chat messages */

/**
 * Encrypts and inserts a human message into the messages table via the
 * send_human_message SECURITY DEFINER RPC. The RPC atomically verifies
 * the caller is a participant, the match is active, no AI turn is
 * pending, inserts the message, and increments the human message
 * counter + flips ai_turn_due when the threshold is met.
 *
 * Returns the plaintext content + the new counter/ai_turn_due state so
 * the client can update its optimistic display without any DB write.
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

  const banCheck = await assertNotBanned(supabase);
  if ("error" in banCheck) return banCheck;

  /* H8: rate-limit the most-called action. */
  if (!(await rateLimit(user.id))) {
    return { error: "Slow down" };
  }

  /* E4: cap message length to prevent DoS/cost amplification. Checked
     before moderation so an oversized payload is rejected without
     being shipped to a classifier. */
  if (content.length > MAX_MESSAGE_LENGTH) {
    return { error: "Message too long" };
  }

  /* Which content policy applies is a property of the pairing, not of
     the sender's display preference. Phase 15 made matches
     cohort-homogeneous, so the match's own cohort answers it for both
     participants; an unreadable or missing row resolves to 'minor',
     which is the stricter policy. */
  const { data: matchRow } = await supabase
    .from("matches")
    .select("cohort")
    .eq("id", matchId)
    .maybeSingle();

  const verdict = await moderateText(content, {
    nsfwAllowed: (matchRow as { cohort?: string } | null)?.cohort === "adult",
    surface: "match",
  });
  if (!verdict.allowed) return { error: verdict.reason };

  const scrubbed = sanitizeAndScrub(content);
  if (!scrubbed.trim()) {
    return { error: "Empty message" };
  }

  const encrypted = encryptMessage(scrubbed);

  /* C1/H1/M2/M6: atomic RPC — no client-side matches.update needed. */
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "send_human_message",
    {
      p_match_id: matchId,
      p_encrypted_content: encrypted,
    }
  );

  if (rpcError || !rpcResult || !Array.isArray(rpcResult) || rpcResult.length === 0) {
    return { error: "Failed to send message" };
  }

  const row = rpcResult[0] as {
    success: boolean;
    message_id: string;
    human_message_count: number;
    ai_turn_due: boolean;
  };

  if (!row.success) {
    return { error: "Failed to send message" };
  }

  return {
    messageId: row.message_id,
    content: scrubbed,
    humanMessageCount: row.human_message_count,
    aiTurnDue: row.ai_turn_due,
  };
}

/**
 * Fetches messages for a match (decrypted server-side) with cursor
 * pagination. RLS ensures only participants can read the rows.
 *
 * M9: the previous version decrypted ALL messages with no limit — a
 * DoS vector on long matches. This version paginates with a default
 * page size of 50 (max 200).
 *
 * Pass `before` (an ISO timestamp) to fetch the page preceding that
 * message's created_at. The first call omits `before` to get the
 * latest page. `hasMore` indicates whether older messages exist.
 */
export async function getMatchMessages(
  matchId: string,
  options?: { before?: string; limit?: number }
): Promise<GetMessagesResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const limit = Math.min(
    Math.max(options?.limit ?? DEFAULT_PAGE_LIMIT, 1),
    MAX_PAGE_LIMIT
  );

  let query = supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (options?.before) {
    query = query.lt("created_at", options.before);
  }

  const { data: rows } = await query;

  if (!rows) return { messages: [], hasMore: false };

  /* If we got limit+1 rows, there's another page — drop the last row. */
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  /* Reverse so messages are oldest-first within the page. */
  const orderedRows = pageRows.reverse();

  const decrypted: DecryptedMessage[] = orderedRows.map((msg) => {
    let content = "";
    try {
      content = decryptMessage(msg.content as string);
    } catch (err) {
      content = "[unreadable]";
      logger.error("decrypt_failed", {
        where: "get_messages",
        messageId: msg.id,
        err,
      });
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

  return { messages: decrypted, hasMore };
}

/**
 * Decrypts a single message's encrypted content. Used by the Realtime
 * handler on the chat/DM pages.
 *
 * M1 fix: the ciphertext is verified to belong to this match before
 * decryption. The admin client fetches the message row by (match_id,
 * content) — if no row matches, the ciphertext doesn't belong to this
 * match and decryption is refused. This closes the decryption-oracle
 * attack where a participant could decrypt arbitrary ciphertext
 * encrypted with the app key.
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

  /* H9: rate-limit decrypt calls to prevent CPU abuse. */
  if (!(await rateLimit(user.id))) {
    return { error: "Slow down" };
  }

  /* M1: verify the caller is a participant AND the ciphertext belongs
     to this match. We use the admin client to look up the message row
     by (match_id, content) — if no row exists, the ciphertext wasn't
     sent in this match and we refuse to decrypt it. */
  const admin = createAdminClient();
  const { data: msgRow } = await admin
    .from("messages")
    .select("id")
    .eq("match_id", matchId)
    .eq("content", encryptedContent)
    .limit(1)
    .maybeSingle();

  if (!msgRow) return { error: "Not authorized" };

  /* Also verify the caller is a participant via the user client (RLS). */
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
 * Reports a conversation. Decrypts all messages in the match (capped
 * to the last 100 — S20) and stores them as an evidence_snapshot in
 * the reports table via the report_conversation SECURITY DEFINER RPC.
 *
 * M5 fix: the RPC verifies the caller is a participant before filing
 * the report. Only the admin (service_role) can read reports — users
 * cannot.
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

  /* Fetch the last 100 messages for the match (S20 cap). RLS: only
     participants can read message rows. */
  const { data: rows } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!rows) {
    return { error: "No messages to report" };
  }

  /* Decrypt the evidence snapshot (oldest-first for readability). */
  const evidence = rows
    .reverse()
    .map((msg) => {
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

  /* M5: file the report via the RPC — it verifies participant + caps
     evidence size. The RPC inserts into the reports table (INSERT-only
     RLS for authenticated; only service_role can read). */
  const { error: rpcError } = await supabase.rpc("report_conversation", {
    p_match_id: matchId,
    p_reason: reason.trim(),
    p_evidence: evidence,
  });

  if (rpcError) {
    return { error: "Failed to file report" };
  }

  return { success: true };
}

/* ════════════════════════════════════════════════════════════════════
 * Phase 7 — DM-specific message action.
 *
 * DM messages flow through `sendDMMessage` which:
 *   1. Verifies the match status is 'revealed' server-side (H4 — the
 *      previous guard was client-only).
 *   2. Refuses media/attachment patterns (no images/voice/video links
 *      or base64 data URIs in DMs — per the spec, DMs are text-only).
 *   3. Delegates to `sendMessage` for the full sanitize+scrub+block+
 *      encrypt+RPC pipeline.
 * ════════════════════════════════════════════════════════════════════ */

/* Patterns that look like media/attachment attempts. DMs are text-only
   per the spec — no image links, voice notes, video links, or base64
   data URIs. The regexes are intentionally conservative to avoid
   blocking legitimate text that happens to contain "mp3" etc. */
const MEDIA_PATTERNS: RegExp[] = [
  /* E5: image/video/audio file extensions in a URL — removed `$` anchor
     so URLs with query strings or fragments after the extension are caught. */
  /\.(png|jpe?g|gif|webp|svg|bmp|mp4|webm|mov|avi|mp3|wav|ogg|m4a|opus)(?:[?#]\S*)?/i,
  /* base64 data URIs (data:image/..., data:video/..., data:audio/...). */
  /^data:(?:image|video|audio)\/[^,]+,/i,
  /* common image-host root paths. */
  /\b(?:imgur\.com\/|i\.imgur\.com\/|media\.discordapp\.net\/|cdn\.discordapp\.com\/attachments\/)/i,
];

function containsMediaPattern(text: string): boolean {
  for (const pattern of MEDIA_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

type SendDMMessageResult =
  | { messageId: string; content: string }
  | { error: string };

/**
 * Sends a DM message. Verifies the match is revealed (server-side,
 * not just client-side — closes H4) and refuses media/attachment
 * patterns so DMs stay text-only. Delegates the actual send (encrypt,
 * insert via send_human_message RPC) to `sendMessage`.
 */
export async function sendDMMessage(
  matchId: string,
  content: string
): Promise<SendDMMessageResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const banCheck = await assertNotBanned(supabase);
  if ("error" in banCheck) return banCheck;

  /* H4: verify the match is revealed + the caller is a participant,
     server-side. The client check on /dm/[id] is bypassable. */
  const { data: match } = await supabase
    .from("matches")
    .select("id")
    .eq("id", matchId)
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .eq("status", "revealed")
    .single();

  if (!match) return { error: "DM not available" };

  /* Phase 7: refuse media/attachment patterns. */
  if (containsMediaPattern(content)) {
    return { error: "DMs are text-only. No media or attachment links." };
  }

  /* Delegate to sendMessage for the full sanitize+scrub+block+RPC pipeline. */
  const result = await sendMessage(matchId, content);

  if ("error" in result) return { error: result.error };

  /* Phase 11: notify the partner of the new DM. Best-effort. */
  const { data: matchRow } = await supabase
    .from("matches")
    .select("user_a, user_b")
    .eq("id", matchId)
    .single();
  if (matchRow) {
    const { user_a, user_b } = matchRow as { user_a: string; user_b: string | null };
    const partnerId = user_a === user.id ? user_b : user_a;
    if (partnerId) {
      await notifyNewDM(partnerId, matchId).catch((err) =>
        logger.error("notify_failed", { kind: "new_dm", matchId, err })
      );
    }
  }

  return {
    messageId: result.messageId,
    content: result.content,
  };
}