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
