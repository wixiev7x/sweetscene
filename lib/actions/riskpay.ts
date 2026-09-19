"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { rateLimit } from "@/lib/utils/ratelimit";
import { logger } from "@/lib/utils/logger";
import { randomUUID, randomBytes } from "node:crypto";
import {
  TOKEN_PACKAGES,
  VIP_PRICE_USD,
} from "@/lib/billing/constants";
import {
  createTemporaryWallet,
  buildPaymentUrl,
  isRiskPayConfigured,
} from "@/lib/riskpay/server";

/* ════════════════════════════════════════════════════════════════════
 * RiskPay billing server actions — fiat checkout (customer pays by
 * card / PayPal / bank via RiskPay's provider page; merchant receives
 * instant USDC on Polygon).
 *
 * Same security posture as the NOWPayments actions: identity from the
 * session, rate limited, price ALWAYS derived server-side, atomic
 * claim on the payments row by the callback route.
 * ════════════════════════════════════════════════════════════════════ */

type BillingResult =
  | { invoiceUrl: string }
  | { error: string };

/** Per-order callback secret — makes the callback URL unguessable and
 *  is verified on every callback before anything is granted. */
function newCallbackSecret(): string {
  return randomBytes(24).toString("hex");
}

async function placeRiskPayOrder(params: {
  kind: "vip" | "tokens";
  amountUsd: number;
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

  if (!isRiskPayConfigured()) {
    logger.warn("riskpay_not_configured", { userId: user.id });
    return { error: "Card payments aren't available right now." };
  }

  /* Customer email for the checkout page — the account's own email. */
  const { data: userData } = await supabase.auth.getUser();
  const email = userData?.user?.email ?? "customer@sweetscene.love";

  const orderRef = `rp-${params.kind}-${randomUUID()}`;
  const callbackSecret = newCallbackSecret();

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
    logger.error("riskpay_payment_row_insert_failed", { orderRef, insertError });
    return { error: "Failed to create order" };
  }

  logger.info("rp_order_created", {
    kind: params.kind,
    orderRef,
    userId: user.id,
    amount: params.amountUsd,
    provider: "riskpay",
  });

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sweetscene.love";

  let wallet;
  try {
    wallet = await createTemporaryWallet({
      orderRef,
      callbackSecret,
      siteUrl: siteUrl.replace(/\/$/, ""),
    });
  } catch (err) {
    logger.error("rp_wallet_creation_failed", { orderRef, err });
    await admin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("order_id", orderRef);
    return { error: "Couldn't start checkout — try again" };
  }

  /* Persist the RiskPay order data on the payments row (payment_id
     carries the ipn_token until the callback replaces it with the
     payout txid; the callback secret + expected receiving address are
     encoded into the callback URL / verified via the status API). */
  const { error: walletError } = await admin
    .from("payments")
    .update({
      payment_id: wallet.ipnToken,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", orderRef);
  if (walletError) {
    logger.error("riskpay_wallet_write_failed", { orderRef, walletError });
  }

  const paymentUrl = buildPaymentUrl({
    addressIn: wallet.addressIn,
    customerEmail: email,
    amountUsd: params.amountUsd,
  });

  logger.info("rp_wallet_created", {
    orderRef,
    polygonAddressIn: wallet.polygonAddressIn,
  });

  return { invoiceUrl: paymentUrl };
}

/** VIP pass via card/PayPal/bank checkout (USDC payout to merchant). */
export async function createRiskPayVIPOrder(): Promise<BillingResult> {
  return placeRiskPayOrder({ kind: "vip", amountUsd: VIP_PRICE_USD });
}

/** Fixed token package via card/PayPal/bank checkout. */
export async function createRiskPayTokenPackageOrder(
  packageId: string
): Promise<BillingResult> {
  const pkg = TOKEN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return { error: "Invalid package" };
  return placeRiskPayOrder({
    kind: "tokens",
    amountUsd: pkg.priceUsd,
    tokenQuantity: pkg.tokens,
  });
}
