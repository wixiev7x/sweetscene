/* ════════════════════════════════════════════════════════════════════
 * Phase 8 — Billing constants.
 *
 * Separated from lib/actions/billing.ts because "use server" files
 * can only export async functions — not const values. Client
 * components import these directly to render package cards.
 * ════════════════════════════════════════════════════════════════════ */

/**
 * Fixed token packages for the profile page purchase buttons. Each
 * package offers a bulk discount over the dynamic per-token rate.
 * Tiers are used for matchmaking and displayed on the profile page.
 */
export const TOKEN_PACKAGES = [
  { id: "starter", tokens: 10_000, priceUsd: 4.99 },
  { id: "standard", tokens: 50_000, priceUsd: 19.99 },
  { id: "whale", tokens: 100_000, priceUsd: 34.99 },
] as const;

/**
 * Per-token price for the dynamic rate (solo play top-up). 1000 tokens
 * = $0.49. Used when the user specifies an arbitrary quantity in the
 * paywall modal.
 */
export const DYNAMIC_TOKEN_RATE_USD = 0.0005;

/**
 * VIP pass price and duration.
 */
export const VIP_PRICE_USD = 9.99;
export const VIP_DURATION_DAYS = 30;

/**
 * VIP plan catalogue — one-time pass plus renewal-based subscriptions.
 *
 * Neither PayRam nor NOWPayments supports merchant-initiated recurring
 * charges (no card-on-file auto-billing exists on either rail), so a
 * "subscription" is an app-layer concept: each period is a normal
 * payment, `grant_vip` stacks the days onto the existing expiry, and
 * the renewal-reminders cron nudges the user a few days before it
 * ends. One payment per period — nothing is ever auto-charged.
 */
export const VIP_PLANS = [
  {
    id: "vip_monthly",
    name: "VIP Monthly",
    priceUsd: 9.99,
    days: 30,
    subscription: true,
    detail: "renews every 30 days",
  },
  {
    id: "vip_yearly",
    name: "VIP Yearly",
    priceUsd: 99.99,
    days: 365,
    subscription: true,
    detail: "renews yearly · 2 months free",
    best: true,
  },
  {
    id: "vip",
    name: "VIP Pass",
    priceUsd: VIP_PRICE_USD,
    days: VIP_DURATION_DAYS,
    subscription: false,
    detail: `${VIP_DURATION_DAYS} days · one-time`,
  },
] as const;

export type VipPlanId = (typeof VIP_PLANS)[number]["id"];

/** Server-side plan lookup — prices are never taken from the client. */
export function getVipPlan(id: string) {
  return VIP_PLANS.find((p) => p.id === id);
}

/**
 * Derives the plan from an order reference on the webhook side. The
 * payments row stores type "vip" for every VIP-family order (the
 * column CHECK predates subscriptions and is deliberately left
 * untouched); the plan lives in the order-id prefix the billing
 * actions create — `vip-…`, `vip_monthly-…`, `vip_yearly-…`, with the
 * PayRam variant prefixed `pr-`. Falls back to the one-time pass.
 */
export function vipPlanFromOrderRef(orderRef: string) {
  const ref = orderRef.replace(/^pr-/, "");
  const plan = VIP_PLANS.find((p) => ref.startsWith(`${p.id}-`));
  return plan ?? VIP_PLANS.find((p) => p.id === "vip")!;
}
