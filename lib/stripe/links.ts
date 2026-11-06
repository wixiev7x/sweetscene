import "server-only";

/* ════════════════════════════════════════════════════════════════════
 * Stripe Payment Link resolution (server-side env reads only).
 *
 * The Stripe integration deliberately uses dashboard-created Payment
 * Links (hosted checkout) instead of a server-side Sessions API:
 * the link URL is static per product, the checkout is entirely
 * Stripe-hosted (no card data ever touches SweetScene), and the only
 * per-purchase state we need rides on the standard
 * `?client_reference_id=` query param — our payments order_id —
 * which Stripe echoes back in checkout.session.completed.
 *
 * Product ↔ env mapping:
 *   vip_monthly → STRIPE_LINK_VIP            (subscription, $9.99/30d)
 *   vip_yearly  → STRIPE_LINK_VIP_YEARLY     (subscription, $99.99/365d)
 *   starter     → STRIPE_LINK_TOKENS_S       (10k, $4.99)
 *   standard    → STRIPE_LINK_TOKENS_M       (50k, $19.99)
 *   whale       → STRIPE_LINK_TOKENS_L       (100k, $34.99)
 * ════════════════════════════════════════════════════════════════════ */

const LINK_ENV_BY_PRODUCT: Record<string, string> = {
  vip_monthly: "STRIPE_LINK_VIP",
  vip_yearly: "STRIPE_LINK_VIP_YEARLY",
  starter: "STRIPE_LINK_TOKENS_S",
  standard: "STRIPE_LINK_TOKENS_M",
  whale: "STRIPE_LINK_TOKENS_L",
};

/** Resolve the Payment Link URL for a product id, or null when the
 *  env var is unset/invalid (product is then simply not offered). */
export function getStripeLinkUrl(productId: string): string | null {
  const envName = LINK_ENV_BY_PRODUCT[productId];
  if (!envName) return null;
  const url = process.env[envName];
  if (!url || !/^https:\/\//.test(url)) return null;
  return url;
}

/** Availability map for the /billing server component — which cards
 *  to render as purchasable vs. "coming soon". Never leaks values. */
export function getStripeBillingAvailability() {
  return {
    vipMonthly: getStripeLinkUrl("vip_monthly") !== null,
    vipYearly: getStripeLinkUrl("vip_yearly") !== null,
    tokensS: getStripeLinkUrl("starter") !== null,
    tokensM: getStripeLinkUrl("standard") !== null,
    tokensL: getStripeLinkUrl("whale") !== null,
    /** Customer portal needs the secret key (creates the session). */
    portal: /^sk_(test|live)_/.test(process.env.STRIPE_SECRET_KEY ?? ""),
    /** Webhook route can only verify deliveries when this is set. */
    webhook: /^whsec_/.test(process.env.STRIPE_WEBHOOK_SECRET ?? ""),
  };
}

/** True when the portal action can run (secret key configured). */
export function isStripeSecretKeyConfigured(): boolean {
  return /^sk_(test|live)_/.test(process.env.STRIPE_SECRET_KEY ?? "");
}
