"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { rateLimit } from "@/lib/utils/ratelimit";
import { logger } from "@/lib/utils/logger";
import { randomUUID } from "node:crypto";
import {
  TOKEN_PACKAGES,
  getVipPlan,
} from "@/lib/billing/constants";
import {
  createPayment,
  isPayRamConfigured,
} from "@/lib/payram/server";

/* ════════════════════════════════════════════════════════════════════
 * PayRam billing server actions — card checkout (customer pays by
 * card / Apple Pay / Google Pay through PayRam's card-to-crypto
 * onramp on the self-hosted gateway's page; the merchant receives
 * USDC on Base).
 *
 * Same security posture as the NOWPayments actions: identity from the
 * session, rate limited, price ALWAYS derived server-side, atomic
 * claim on the payments row by the webhook route.
 * ════════════════════════════════════════════════════════════════════ */

type BillingResult =
  | { invoiceUrl: string }
  | { error: string };

async function placePayRamOrder(params: {
  kind: "vip" | "tokens";
  amountUsd: number;
  planId?: string;
  tokenQuantity?: number;
}): Promise<BillingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Too many requests. Slow down." };
  }

  if (!isPayRamConfigured()) {
    logger.warn("payram_not_configured", { userId: user.id });
    return { error: "Card payments aren't available right now." };
  }

  /* Customer email for the checkout page — the account's own email. */
  const email = user.email ?? "customer@sweetscene.love";

  /* Order ref carries the plan in its prefix — the webhook derives the
     grant days back from it (vip_monthly → 30, vip_yearly → 365). */
  const orderRef = `pr-${params.planId ?? params.kind}-${randomUUID()}`;

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("payments").insert({
    order_id: orderRef,
    user_id: user.id,
    type: params.kind === "vip" ? "vip" : "tokens",
    status: "pending",
    amount: params.amountUsd,
    currency: "usd",
    ...(params.tokenQuantity ? { token_quantity: params.tokenQuantity } : {}),
  });
  if (insertError) {
    logger.error("payram_payment_row_insert_failed", { orderRef, insertError });
    return { error: "Failed to create order" };
  }

  logger.info("payram_order_created", {
    kind: params.kind,
    orderRef,
    userId: user.id,
    amount: params.amountUsd,
    provider: "payram",
  });

  let payment;
  try {
    payment = await createPayment({
      orderRef,
      customerId: user.id,
      customerEmail: email,
      amountUsd: params.amountUsd,
    });
  } catch (err) {
    logger.error("payram_payment_creation_failed", { orderRef, err });
    await admin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("order_id", orderRef);
    return { error: "Couldn't start checkout — try again" };
  }

  /* Persist the PayRam reference on the payments row — the webhook
     cross-checks the gateway's own status API with it before any
     grant. */
  const { error: refError } = await admin
    .from("payments")
    .update({
      payment_id: payment.referenceId,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", orderRef);
  if (refError) {
    logger.error("payram_reference_write_failed", { orderRef, refError });
  }

  logger.info("payram_payment_created", {
    orderRef,
    referenceId: payment.referenceId,
  });

  return { invoiceUrl: payment.paymentUrl };
}

/** VIP pass via card / Apple Pay / Google Pay checkout (card-to-crypto
 *  onramp; USDC on Base to the merchant wallet). */
export async function createPayRamVIPOrder(): Promise<BillingResult> {
  return createPayRamVipPlanOrder("vip");
}

/** Any VIP-family plan via card checkout — the one-time pass or a
 *  renewal-based subscription (monthly / yearly). The plan is looked
 *  up server-side; the webhook derives it back from the order-id
 *  prefix and grants the matching days via grant_vip (stacking). */
export async function createPayRamVipPlanOrder(
  planId: string
): Promise<BillingResult> {
  const plan = getVipPlan(planId);
  if (!plan) return { error: "Invalid plan" };
  return placePayRamOrder({
    kind: "vip",
    planId: plan.id,
    amountUsd: plan.priceUsd,
  });
}

/** Fixed token package via card / Apple Pay / Google Pay checkout. */
export async function createPayRamTokenPackageOrder(
  packageId: string
): Promise<BillingResult> {
  const pkg = TOKEN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return { error: "Invalid package" };
  return placePayRamOrder({
    kind: "tokens",
    amountUsd: pkg.priceUsd,
    tokenQuantity: pkg.tokens,
  });
}
