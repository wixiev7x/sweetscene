import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { notifySubscriptionRenewalDue } from "@/lib/notifications/dispatch";
import { logger } from "@/lib/utils/logger";

/* ════════════════════════════════════════════════════════════════════
 * Subscription renewal reminders — daily cron (vercel.json).
 *
 * Renewal-based subscriptions never auto-charge (no card-on-file
 * rail exists on PayRam/NOWPayments), so the app nudges the member a
 * few days before their VIP period ends; one payment extends it.
 *
 * The renewal state IS profiles.vip_expires_at — grant_vip stacks
 * every paid period onto it, so one query covers subscription
 * members and stacked one-time passes alike. A notification is only
 * sent if none of this type was delivered in the last 20 hours, so
 * the daily window fires at most one reminder per period.
 * ════════════════════════════════════════════════════════════════════ */

const WINDOW_DAYS = 3;

export async function POST() {
  try {
    return await run();
  } catch (err) {
    logger.error("subscription_reminders_error", { err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function run(): Promise<NextResponse> {
  const admin = createAdminClient();

  const now = Date.now();
  const from = new Date(now + (WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000);
  const to = new Date(now + (WINDOW_DAYS + 0.5) * 24 * 60 * 60 * 1000);
  const dedupeSince = new Date(now - 20 * 60 * 60 * 1000);

  const { data: expiring, error } = await admin
    .from("profiles")
    .select("id, vip_expires_at")
    .eq("is_vip", true)
    .gte("vip_expires_at", from.toISOString())
    .lte("vip_expires_at", to.toISOString());

  if (error || !expiring) {
    logger.error("subscription_reminders_query_failed", { error });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;

  for (const row of expiring as { id: string; vip_expires_at: string }[]) {
    /* Idempotency — skip if a reminder of this type went out recently
       (best-effort; a failure here still sends, worst case a dup). */
    try {
      const { count } = await admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", row.id)
        .eq("type", "subscription_renewal_due")
        .gte("created_at", dedupeSince.toISOString());
      if (count && count > 0) {
        skipped++;
        continue;
      }
    } catch {
      /* fall through and send */
    }

    await notifySubscriptionRenewalDue(
      row.id,
      new Date(row.vip_expires_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    ).catch(() => {});
    sent++;
  }

  logger.info("subscription_reminders_run", {
    expiring: expiring.length,
    sent,
    skipped,
  });

  return NextResponse.json({ expiring: expiring.length, sent, skipped });
}
