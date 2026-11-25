import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { isCronAuthorized } from "@/lib/utils/cron-auth";
import { logger } from "@/lib/utils/logger";

/* Weekly leaderboard payout (Monday 00:05 UTC). Rewards the PREVIOUS
 * ISO week. Idempotent: leaderboard_rewards (week_start, user_id) PK and
 * the payment ref passed to grant_vip/credit_tokens make reruns no-ops. */

const PRIZES: { from: number; to: number; reward: string; days?: number; tokens?: number }[] = [
  { from: 1, to: 1, reward: "flame_30d", days: 30 },
  { from: 2, to: 3, reward: "ember_30d", days: 30 },
  { from: 4, to: 10, reward: "tokens_20k", tokens: 20_000 },
];

function lastWeekStart(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow - 7);
  return d.toISOString().slice(0, 10);
}

async function handle(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const week = lastWeekStart();
  const { data: rows, error } = await admin.rpc("weekly_leaderboard", { p_week_start: week, p_limit: 10 } as never);
  if (error) {
    logger.error("weekly_rewards_board", { err: error });
    return NextResponse.json({ error: "board" }, { status: 500 });
  }
  const board = (rows ?? []) as { rank: number; user_id: string; points: number }[];
  let granted = 0;
  for (const r of board) {
    const prize = PRIZES.find((p) => r.rank >= p.from && r.rank <= p.to);
    if (!prize) continue;
    const { error: claimErr } = await admin.from("leaderboard_rewards").insert({ week_start: week, user_id: r.user_id, rank: r.rank, reward: prize.reward });
    if (claimErr) continue; // already rewarded for this week
    const ref = `lb-${week}-${r.user_id}`;
    const undo = () => admin.from("leaderboard_rewards").delete().eq("week_start", week).eq("user_id", r.user_id);
    const res = prize.days
      ? await admin.rpc("grant_vip", { p_user_id: r.user_id, p_days: prize.days, p_payment_id: ref } as never)
      : await admin.rpc("credit_tokens", { p_user_id: r.user_id, p_amount: prize.tokens!, p_reason: "leaderboard", p_payment_id: ref } as never);
    if (res.error) {
      /* Release the claim so the next run retries this winner. */
      await undo();
      logger.error("weekly_rewards_grant", { err: res.error, user: r.user_id });
      continue;
    }
    await admin.from("notifications").insert({
      user_id: r.user_id,
      type: "leaderboard_reward",
      title: `You placed #${r.rank} this week`,
      body: prize.days ? "Your reward is active now. Enjoy the heat." : `${prize.tokens!.toLocaleString("en-US")} tokens added to your balance.`,
    });
    granted++;
  }
  return NextResponse.json({ week, granted });
}

export const GET = handle;
export const POST = handle;
