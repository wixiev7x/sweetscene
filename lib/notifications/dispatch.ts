import "server-only";
import { createAdminClient } from "@/lib/supabase/server-admin";

/* ════════════════════════════════════════════════════════════════════
 * Phase 12 — Notification dispatch (server-internal).
 *
 * WHY THIS FILE EXISTS
 *
 * These helpers used to live in lib/actions/notifications.ts, whose
 * first line is "use server". Every export from such a file is compiled
 * into a client-callable RPC endpoint with a public ID — the browser
 * does not need to import it to reach it, it just needs the ID, which
 * ships in the bundle. The original comment on createNotification read
 * "Not exported as a server action", which was the exact opposite of
 * what the code did.
 *
 * That made the following reachable by anyone, authenticated or not:
 *
 *   createNotification({ userId: <any victim>, type: "admin_message",
 *                        title: "Account verification required",
 *                        body: "Confirm your details at ..." })
 *
 * — arbitrary content, addressed to any user, rendered inside the
 * platform's own trusted notification UI, written through the
 * service-role client that bypasses RLS. A ready-made phishing channel
 * with the platform's credibility attached, and no rate limit.
 *
 * This file has NO "use server" directive, so nothing in it is
 * addressable from the browser. It is plain server-side code that other
 * server actions import and call in-process. `import "server-only"`
 * turns any accidental client import into a build error.
 *
 * Rule of thumb: "use server" marks a trust boundary, not a location.
 * Put a function there only if an untrusted caller is allowed to invoke
 * it with arguments of their choosing.
 * ════════════════════════════════════════════════════════════════════ */

export type NotificationType =
  | "match_found"
  | "reveal_request"
  | "reveal_complete"
  | "new_dm"
  | "rating_received"
  | "token_refund"
  | "tokens_purchased"
  | "vip_granted"
  | "admin_message";

export type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read_at: string | null;
  match_id: string | null;
  created_at: string;
};

/**
 * Creates a notification for a user via the admin (service-role)
 * client. Server-internal: callers are trusted to have already
 * established that the notification is warranted.
 */
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  matchId?: string;
}): Promise<string | null> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("create_notification", {
    p_user_id: params.userId,
    p_type: params.type,
    p_title: params.title,
    p_body: params.body ?? "",
    p_match_id: params.matchId ?? null,
  });

  if (error || !data) return null;

  return data as string;
}

/**
 * Convenience wrappers for common notification types, called by
 * matchmaking, reveal, messages, ratings and the payment webhook at
 * the appropriate moments.
 */

export async function notifyMatchFound(
  userId: string,
  matchId: string
): Promise<void> {
  await createNotification({
    userId,
    type: "match_found",
    title: "New match!",
    body: "You've been matched. Say hello — the fog is thick.",
    matchId,
  });
}

export async function notifyRevealRequest(
  userId: string,
  matchId: string,
  partnerName: string
): Promise<void> {
  await createNotification({
    userId,
    type: "reveal_request",
    title: "Reveal request",
    body: `${partnerName} wants to lift the fog. Open the chat to decide.`,
    matchId,
  });
}

export async function notifyRevealComplete(
  userId: string,
  matchId: string
): Promise<void> {
  await createNotification({
    userId,
    type: "reveal_complete",
    title: "Fog lifted!",
    body: "You've both revealed. Head to DMs to keep talking.",
    matchId,
  });
}

export async function notifyNewDM(
  userId: string,
  matchId: string
): Promise<void> {
  await createNotification({
    userId,
    type: "new_dm",
    title: "New message",
    body: "You have a new direct message.",
    matchId,
  });
}

export async function notifyRatingReceived(
  userId: string,
  matchId: string,
  vibe: string
): Promise<void> {
  await createNotification({
    userId,
    type: "rating_received",
    title: "Vibe Check received",
    body: `Your partner rated the scene: ${vibe}.`,
    matchId,
  });
}

export async function notifyTokenRefund(
  userId: string,
  amount: number
): Promise<void> {
  await createNotification({
    userId,
    type: "token_refund",
    title: "Tokens refunded",
    body: `${amount} tokens were refunded to your wallet.`,
  });
}

/**
 * Sent when a token purchase confirms. Distinct from
 * `notifyTokenRefund` — the webhook previously reused the refund
 * wrapper, so paying users were told their tokens had been "refunded".
 */
export async function notifyTokensPurchased(
  userId: string,
  amount: number
): Promise<void> {
  await createNotification({
    userId,
    type: "tokens_purchased",
    title: "Tokens added",
    body: `${amount.toLocaleString()} tokens were added to your wallet.`,
  });
}

export async function notifyVipGranted(userId: string): Promise<void> {
  await createNotification({
    userId,
    type: "vip_granted",
    title: "VIP activated",
    body: "Your VIP membership is now active. Enjoy the perks!",
  });
}
