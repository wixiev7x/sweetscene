"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { rateLimit } from "@/lib/utils/ratelimit";
import { logger } from "@/lib/utils/logger";
import { randomUUID } from "node:crypto";
import { TOKEN_PACKAGES, getVipPlan } from "@/lib/billing/constants";
import {
  getStripeLinkUrl,
  isStripeSecretKeyConfigured,
} from "@/lib/stripe/links";

/* ════════════════════════════════════════════════════════════════════
 * Stripe billing server actions (Phase 2 — card checkout via
 * dashboard-created Payment Links).
 *
 * Same security posture as the legacy rails these replace:
 *   - identity from the session (never from the client payload),
 *   - rate limited per user,
 *   - price ALWAYS derived server-side from lib/billing/constants
 *     (the client only sends a product id),
 *   - a pending `payments` row is inserted BEFORE the redirect, and
 *     the webhook's grant is guarded by the atomic claim on that row
 *     — replays and double-fires are no-ops.
 *
 * The Stripe twist: instead of calling a gateway API to create an
 * invoice, we redirect to the product's static Payment Link with
 * `?client_reference_id={order_id}`. Stripe echoes that reference in
 * checkout.session.completed, which is how the webhook finds the
 * row — the payments.order_id IS the client_reference_id.
 * ════════════════════════════════════════════════════════════════════ */

type CheckoutResult =
  | { url: string }
  | { error: string };

async function startStripeCheckout(params: {
  productId: string;
  kind: "vip" | "tokens";
  amountUsd: number;
  tokenQuantity?: number;
}): Promise<CheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Too many requests. Slow down." };
  }

  const linkUrl = getStripeLinkUrl(params.productId);
  if (!linkUrl) {
    logger.warn("stripe_link_not_configured", {
      productId: params.productId,
      userId: user.id,
    });
    return { error: "Card payments aren't available right now." };
  }

  /* Order ref carries the product in its prefix — the webhook derives
     the grant (plan days / token quantity anchor) back from it, and
     the payments row stores the user + price we expect to settle. */
  const orderRef = `stripe-${params.productId}-${randomUUID()}`;

  const admin = createAdminClient();

  /* Supersede this user's older still-pending rows of the same kind —
     an abandoned checkout should never race a fresh one at the
     webhook (same hygiene the legacy rail had). */
  await admin
    .from("payments")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("type", params.kind)
    .eq("status", "pending")
    .like("order_id", "stripe-%");

  const { error: insertError } = await admin.from("payments").insert({
    order_id: orderRef,
    user_id: user.id,
    type: params.kind,
    status: "pending",
    amount: params.amountUsd,
    currency: "usd",
    ...(params.tokenQuantity ? { token_quantity: params.tokenQuantity } : {}),
  });
  if (insertError) {
    logger.error("stripe_payment_row_insert_failed", {
      orderRef,
      insertError,
    });
    return { error: "Failed to create order" };
  }

  logger.info("stripe_order_created", {
    kind: params.kind,
    productId: params.productId,
    orderRef,
    userId: user.id,
    amount: params.amountUsd,
    provider: "stripe",
  });

  return { url: `${linkUrl}?client_reference_id=${encodeURIComponent(orderRef)}` };
}

/** VIP plan via card checkout — monthly or yearly subscription
 *  (the one-time pass has no Payment Link; subscriptions only). */
export async function createStripeVipOrder(planId: string): Promise<CheckoutResult> {
  const plan = getVipPlan(planId);
  if (!plan || plan.id === "vip") return { error: "Invalid plan" };
  return startStripeCheckout({
    productId: plan.id,
    kind: "vip",
    amountUsd: plan.priceUsd,
  });
}

/** Fixed token package via card checkout. */
export async function createStripeTokenPackageOrder(
  packageId: string,
): Promise<CheckoutResult> {
  const pkg = TOKEN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return { error: "Invalid package" };
  return startStripeCheckout({
    productId: pkg.id,
    kind: "tokens",
    amountUsd: pkg.priceUsd,
    tokenQuantity: pkg.tokens,
  });
}

/** "Manage subscription" — creates a Stripe customer-portal session
 *  for the signed-in user and returns its URL. Requires the user to
 *  have checked out at least once (we need their Stripe customer id)
 *  and the portal to be configured in the Stripe dashboard. */
export async function openStripeCustomerPortal(): Promise<CheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Too many requests. Slow down." };
  }

  if (!isStripeSecretKeyConfigured()) {
    logger.warn("stripe_portal_secret_missing", { userId: user.id });
    return { error: "Subscription management isn't available right now." };
  }

  const admin = createAdminClient();
  const { data: customerRow } = await admin
    .from("stripe_customers")
    .select("customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!customerRow?.customer_id) {
    return { error: "No card billing profile found — make a purchase first." };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  const returnUrl = origin
    ? `${origin.replace(/\/$/, "")}/billing`
    : "https://sweetscene.love/billing";

  let portalUrl: string | undefined;
  try {
    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: customerRow.customer_id,
        return_url: returnUrl,
      }),
    });
    if (res.ok) {
      portalUrl = ((await res.json()) as { url?: string }).url;
    } else {
      logger.error("stripe_portal_session_failed", {
        status: res.status,
        userId: user.id,
      });
    }
  } catch (err) {
    logger.error("stripe_portal_session_error", { err, userId: user.id });
  }

  if (!portalUrl) {
    return { error: "Couldn't open the billing portal — try again." };
  }

  logger.info("stripe_portal_session_created", { userId: user.id });
  return { url: portalUrl };
}
