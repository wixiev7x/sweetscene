"use server";

import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { rateLimit } from "@/lib/utils/ratelimit";
import { logger } from "@/lib/utils/logger";
import { TOKEN_PACKAGES, getVipPlan } from "@/lib/billing/constants";
import { getPaddlePriceId, paddleFetch } from "@/lib/paddle/config";

/* ════════════════════════════════════════════════════════════════════
 * Paddle card checkout (merchant of record).
 *
 * Security posture:
 *  - identity from the session, never the client payload;
 *  - rate limited per user;
 *  - price id + amount derived server-side (client sends product id);
 *  - a pending `payments` row is written BEFORE the transaction is
 *    created; the webhook matches custom_data.order_ref back to it and
 *    re-checks the line item price id before granting (atomic claim —
 *    replays and double-fires are no-ops).
 * ════════════════════════════════════════════════════════════════════ */

type CheckoutResult = { url: string } | { error: string };

async function startPaddleCheckout(params: {
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
  if (!(await rateLimit(user.id))) return { error: "Too many requests. Slow down." };

  const priceId = getPaddlePriceId(params.productId);
  if (!priceId) {
    logger.warn("paddle_price_not_configured", { productId: params.productId });
    return { error: "Card payments aren't available right now." };
  }

  const orderRef = `pdl-${params.productId}-${randomUUID()}`;
  const admin = createAdminClient();

  /* Close this user's stale pending card orders of the same kind so the
     payments table doesn't accumulate abandoned checkouts. */
  await admin
    .from("payments")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("type", params.kind)
    .eq("status", "pending")
    .like("order_id", "pdl-%");

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
    logger.error("paddle_payment_row_insert_failed", { orderRef, insertError });
    return { error: "Failed to create order" };
  }

  const txn = await paddleFetch<{ id: string; checkout?: { url?: string | null } }>(
    "/transactions",
    {
      method: "POST",
      body: {
        items: [{ price_id: priceId, quantity: 1 }],
        collection_mode: "automatic",
        custom_data: { order_ref: orderRef, user_id: user.id },
      },
    },
  );

  const url = txn.ok ? txn.data.checkout?.url : null;
  if (!txn.ok || !url) {
    logger.error("paddle_transaction_create_failed", {
      orderRef,
      status: txn.ok ? 200 : txn.status,
      code: txn.ok ? "no_checkout_url" : txn.code,
    });
    await admin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("order_id", orderRef);
    return { error: "Couldn't start checkout — try again." };
  }

  await admin
    .from("payments")
    .update({ payment_id: txn.data.id, updated_at: new Date().toISOString() })
    .eq("order_id", orderRef);

  logger.info("paddle_order_created", {
    orderRef,
    kind: params.kind,
    productId: params.productId,
    userId: user.id,
  });
  return { url };
}

/** VIP subscription (monthly / yearly) via Paddle. */
export async function createPaddleVipOrder(planId: string): Promise<CheckoutResult> {
  const plan = getVipPlan(planId);
  if (!plan || !plan.subscription) return { error: "Invalid plan" };
  return startPaddleCheckout({ productId: plan.id, kind: "vip", amountUsd: plan.priceUsd });
}

/** Fixed gem/token pack via Paddle. */
export async function createPaddleTokenPackageOrder(packageId: string): Promise<CheckoutResult> {
  const pkg = TOKEN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return { error: "Invalid package" };
  return startPaddleCheckout({
    productId: pkg.id,
    kind: "tokens",
    amountUsd: pkg.priceUsd,
    tokenQuantity: pkg.tokens,
  });
}

/** "Manage subscription" — Paddle customer portal session. */
export async function openPaddleCustomerPortal(): Promise<CheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!(await rateLimit(user.id))) return { error: "Too many requests. Slow down." };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("paddle_customers")
    .select("customer_id, subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row?.customer_id) return { error: "No subscription found yet." };

  const session = await paddleFetch<{
    urls?: { general?: { overview?: string } };
  }>(`/customers/${encodeURIComponent(row.customer_id)}/portal-sessions`, {
    method: "POST",
    body: row.subscription_id ? { subscription_ids: [row.subscription_id] } : {},
  });
  const url = session.ok ? session.data.urls?.general?.overview : null;
  if (!url) {
    logger.error("paddle_portal_session_failed", {
      userId: user.id,
      status: session.ok ? 200 : session.status,
    });
    return { error: "Couldn't open billing portal — try again." };
  }
  return { url };
}
