"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentRecord, SubscriptionRecord } from "@/lib/types";

/* ════════════════════════════════════════════════════════════════════
 * Payment records + subscription visibility for the admin panel.
 *
 * These are "use server" exports — every one is an RPC endpoint the
 * browser can call with arguments of its choosing, so each re-checks
 * the super-admin session (requireSuperAdmin) before touching the
 * service-role client. The payments/subscriptions tables carry no RLS
 * policies for authenticated/anon — only this client may read them.
 *
 * Subscriptions are renewal-based (no card-on-file rail exists on
 * PayRam/NOWPayments): the state IS profiles.vip_expires_at — grant_vip
 * stacks every paid period — and the plan lives in the order-id prefix
 * the billing actions create (vip_monthly / vip_yearly / vip).
 * ════════════════════════════════════════════════════════════════════ */

const PAGE_SIZE = 50;

type PlanInfo = { plan: string; plan_label: string };

function planFromOrderRef(orderRef: string): PlanInfo {
  const ref = orderRef.replace(/^pr-/, "");
  if (ref.startsWith("vip_yearly-"))
    return { plan: "vip_yearly", plan_label: "VIP Yearly (sub)" };
  if (ref.startsWith("vip_monthly-"))
    return { plan: "vip_monthly", plan_label: "VIP Monthly (sub)" };
  if (ref.startsWith("vip-"))
    return { plan: "vip", plan_label: "VIP Pass (one-time)" };
  return { plan: "tokens", plan_label: "Token pack" };
}

function sanitizeSearch(search: string | undefined): string {
  return (search ?? "").trim().replace(/[%_(),]/g, "").slice(0, 60);
}

export async function getPaymentRecords(opts: {
  status?: string;
  type?: string;
  search?: string;
  offset?: number;
}): Promise<{ records: PaymentRecord[]; total: number }> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const offset = Math.max(0, opts.offset ?? 0);
  const search = sanitizeSearch(opts.search);

  let query = admin
    .from("payments")
    .select(
      "id, order_id, user_id, type, status, amount, currency, token_quantity, payment_id, created_at, updated_at, profiles(anonymous_username)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (opts.status) query = query.eq("status", opts.status);
  if (opts.type) query = query.eq("type", opts.type);
  if (search) query = query.or(`order_id.ilike.%${search}%,payment_id.ilike.%${search}%`);

  const { data, count, error } = await query;
  if (error || !data) return { records: [], total: 0 };

  const records: PaymentRecord[] = (
    data as unknown as Array<
      Record<string, unknown> & {
        profiles: { anonymous_username: string | null } | null;
      }
    >
  ).map((r) => {
    const { plan, plan_label } = planFromOrderRef(String(r.order_id ?? ""));
    return {
      id: String(r.id),
      order_id: String(r.order_id ?? ""),
      user_id: String(r.user_id ?? ""),
      username: r.profiles?.anonymous_username ?? null,
      type: String(r.type ?? ""),
      plan,
      plan_label,
      status: String(r.status ?? ""),
      amount: Number(r.amount ?? 0),
      currency: (r.currency as string | null) ?? null,
      token_quantity: (r.token_quantity as number | null) ?? null,
      payment_id: (r.payment_id as string | null) ?? null,
      created_at: (r.created_at as string | null) ?? null,
      updated_at: (r.updated_at as string | null) ?? null,
    };
  });

  return { records, total: count ?? records.length };
}

export async function getSubscriptionRecords(
  search?: string
): Promise<SubscriptionRecord[]> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const term = sanitizeSearch(search);

  /* 1. Every active VIP member — the renewal state IS vip_expires_at. */
  let profilesQuery = admin
    .from("profiles")
    .select("id, anonymous_username, vip_expires_at")
    .eq("is_vip", true)
    .not("vip_expires_at", "is", null)
    .order("vip_expires_at", { ascending: false })
    .limit(200);

  if (term)
    profilesQuery = profilesQuery.ilike("anonymous_username", `%${term}%`);

  const { data: members, error: profilesError } = await profilesQuery;
  if (profilesError || !members) return [];

  const ids = (members as Array<{ id: string }>).map((m) => m.id);
  if (ids.length === 0) return [];

  /* 2. Their confirmed VIP payments — the plan + totals. */
  const { data: payments } = await admin
    .from("payments")
    .select("user_id, order_id, amount, status, created_at")
    .in("user_id", ids)
    .eq("type", "vip")
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(5000);

  type PayRow = { user_id: string; order_id: string; amount: number; created_at: string | null };
  const pays = (payments ?? []) as unknown as PayRow[];

  const now = Date.now();
  const SOON = 3 * 24 * 60 * 60 * 1000;

  return (members as Array<{
    id: string;
    anonymous_username: string | null;
    vip_expires_at: string;
  }>).map((m) => {
    const mine = pays.filter((p) => p.user_id === m.id);
    const total = mine.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    /* Most recent confirmed VIP payment defines the current plan. */
    const { plan, plan_label } = mine.length
      ? planFromOrderRef(mine[0].order_id)
      : { plan: "vip", plan_label: "VIP (legacy)" };
    const expiry = new Date(m.vip_expires_at).getTime();
    return {
      user_id: m.id,
      username: m.anonymous_username,
      plan,
      plan_label,
      vip_expires_at: m.vip_expires_at,
      status: expiry - now < SOON ? "expiring_soon" : "active",
      total_paid: Math.round(total * 100) / 100,
      payments_count: mine.length,
      last_payment_at: mine[0]?.created_at ?? null,
    };
  });
}
