import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import {
  notifyVipGranted,
  notifyTokensPurchased,
  notifySubscriptionActive,
} from "@/lib/notifications/dispatch";
import { logger } from "@/lib/utils/logger";
import { getVipPlan, vipPlanFromOrderRef } from "@/lib/billing/constants";
import {
  findCanary,
  reportCanaryHit,
  recordInvalidSignature,
  isSignatureBruteforceBlocked,
} from "@/lib/security/canary";
import { getClientIp } from "@/lib/utils/ratelimit";
import { verifyPaddleSignature } from "@/lib/paddle/signature";
import {
  getPaddlePriceId,
  getPaddleWebhookSecret,
  productForPriceId,
} from "@/lib/paddle/config";

/* ════════════════════════════════════════════════════════════════════
 * Paddle Billing webhook — POST /api/webhooks/paddle
 *
 * SECURITY MODEL (same layers as the retired Stripe route):
 *  1. HMAC signature over the exact raw bytes, verified BEFORE parsing.
 *  2. Per-IP bruteforce throttle on bad signatures.
 *  3. Canary/honeytoken check on the payload.
 *  4. Event-id ledger (paddle_events) — duplicates are acked no-ops.
 *  5. Order identity — custom_data.order_ref must be OUR pending row;
 *     user, product and grant come from that row, and the transaction's
 *     line item price id must equal the configured price for it.
 *  6. Atomic pending→confirmed claim before any grant.
 *
 * Events:
 *  transaction.completed            → first purchase grant, or renewal
 *                                     (origin subscription_recurring)
 *  subscription.created/updated/
 *    canceled/past_due/paused       → status sync only (never grants)
 *  adjustment.created/updated       → approved refund/chargeback marks
 *                                     the payment refunded (no auto
 *                                     clawback — reconcile in admin)
 * Unknown types are acked.
 * ════════════════════════════════════════════════════════════════════ */

const MAX_BODY_BYTES = 256 * 1024;
const ORDER_REF_RE = /^pdl-([a-z0-9_]+)-[0-9a-f-]{36}$/;

type Admin = ReturnType<typeof createAdminClient>;

type PaddleEvent = {
  event_id?: string;
  event_type?: string;
  data?: Record<string, unknown>;
};

type Transaction = {
  id?: string;
  status?: string;
  origin?: string;
  customer_id?: string | null;
  subscription_id?: string | null;
  custom_data?: { order_ref?: unknown } | null;
  items?: Array<{ price?: { id?: string } | null; price_id?: string; quantity?: number }>;
  details?: { line_items?: Array<{ price_id?: string; quantity?: number }> } | null;
};

type Subscription = { id?: string; status?: string; customer_id?: string | null };

type Adjustment = { id?: string; action?: string; status?: string; transaction_id?: string | null };

type PaymentRow = {
  id: string;
  user_id: string;
  type: string;
  status: string;
  token_quantity: number | null;
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    return await handle(request);
  } catch (err) {
    logger.error("paddle_webhook_internal_error", { err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function handle(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (isSignatureBruteforceBlocked(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const secret = getPaddleWebhookSecret();
  if (!secret) {
    logger.error("paddle_webhook_not_configured");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const sigHeader = request.headers.get("paddle-signature");
  const check = verifyPaddleSignature(rawBody, sigHeader, secret);
  if (!check.ok) {
    recordInvalidSignature(ip);
    logger.warn("paddle_webhook_bad_signature", { reason: check.reason, hasHeader: !!sigHeader });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaddleEvent;
  try {
    event = JSON.parse(rawBody) as PaddleEvent;
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }
  if (!event.event_id || !event.event_type) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const canary = findCanary(sigHeader ?? "", event.event_id, JSON.stringify(event.data ?? {}).slice(0, 512));
  if (canary) {
    reportCanaryHit(canary, { surface: "paddle_webhook" });
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: inserted, error: ledgerError } = await admin
    .from("paddle_events")
    .upsert(
      { event_id: event.event_id, event_type: event.event_type },
      { onConflict: "event_id", ignoreDuplicates: true },
    )
    .select("event_id");
  if (ledgerError) {
    logger.error("paddle_event_ledger_failed", { ledgerError });
    return NextResponse.json({ error: "Ledger unavailable" }, { status: 500 });
  }
  if (!inserted || inserted.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const data = event.data ?? {};
  try {
    switch (event.event_type) {
      case "transaction.completed":
        return await onTransactionCompleted(admin, data as Transaction);
      case "subscription.created":
      case "subscription.updated":
      case "subscription.canceled":
      case "subscription.past_due":
      case "subscription.paused":
      case "subscription.resumed":
      case "subscription.activated":
        return await onSubscriptionChange(admin, data as Subscription);
      case "adjustment.created":
      case "adjustment.updated":
        return await onAdjustment(admin, data as Adjustment);
      default:
        return NextResponse.json({ received: true, ignored: true });
    }
  } catch (err) {
    /* Drop the ledger row so Paddle's retry of this event re-runs the
       handler (grants are still guarded by the atomic claim). */
    await admin.from("paddle_events").delete().eq("event_id", event.event_id);
    logger.error("paddle_webhook_handler_error", { type: event.event_type, err });
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}

function lineItems(txn: Transaction): Array<{ priceId: string; quantity: number }> {
  const fromItems = (txn.items ?? []).map((i) => ({
    priceId: i.price?.id ?? i.price_id ?? "",
    quantity: i.quantity ?? 1,
  }));
  if (fromItems.length) return fromItems;
  return (txn.details?.line_items ?? []).map((i) => ({
    priceId: i.price_id ?? "",
    quantity: i.quantity ?? 1,
  }));
}

/* ── transaction.completed ───────────────────────────────────────── */
async function onTransactionCompleted(admin: Admin, txn: Transaction): Promise<NextResponse> {
  if (txn.origin === "subscription_recurring") return onRenewal(admin, txn);

  const orderRef = typeof txn.custom_data?.order_ref === "string" ? txn.custom_data.order_ref : "";
  const m = ORDER_REF_RE.exec(orderRef);
  if (!m) {
    logger.warn("paddle_unknown_order_ref", { txn: (txn.id ?? "").slice(0, 32) });
    return NextResponse.json({ status: "ignored_unknown_order" });
  }
  const productId = m[1];

  const { data: paymentRaw } = await admin
    .from("payments")
    .select("id, user_id, type, status, token_quantity")
    .eq("order_id", orderRef)
    .maybeSingle();
  const payment = paymentRaw as PaymentRow | null;
  if (!payment) {
    logger.warn("paddle_order_not_found", { orderRef: orderRef.slice(0, 40) });
    return NextResponse.json({ status: "unknown_order" });
  }
  if (payment.status === "confirmed") return NextResponse.json({ status: "already_confirmed" });

  /* Price integrity: exactly one line, the configured price, qty 1. */
  const items = lineItems(txn);
  const expectedPrice = getPaddlePriceId(productId);
  if (
    !expectedPrice ||
    items.length !== 1 ||
    items[0].priceId !== expectedPrice ||
    items[0].quantity !== 1
  ) {
    logger.error("paddle_price_mismatch", { orderRef: orderRef.slice(0, 40), productId });
    await admin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", payment.id)
      .eq("status", "pending");
    return NextResponse.json({ status: "price_mismatch" });
  }

  const { data: claimed, error: claimError } = await admin
    .from("payments")
    .update({
      status: "confirmed",
      payment_id: txn.id ?? orderRef,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .neq("status", "confirmed")
    .select("id");
  if (claimError) throw new Error("claim failed");
  if (!claimed || claimed.length === 0) return NextResponse.json({ status: "already_confirmed" });

  if (txn.customer_id) {
    await admin.from("paddle_customers").upsert(
      {
        user_id: payment.user_id,
        customer_id: txn.customer_id,
        ...(txn.subscription_id
          ? { subscription_id: txn.subscription_id, subscription_status: "active" }
          : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  const anchor = txn.id ?? orderRef;
  const vipPlan = payment.type === "vip" ? vipPlanFromOrderRef(orderRef) : null;
  let grantError: string | null = null;
  if (vipPlan) {
    const { error } = await admin.rpc("grant_vip", {
      p_user_id: payment.user_id,
      p_days: vipPlan.days,
      p_payment_id: anchor,
    } as never);
    if (error) grantError = "grant_vip failed";
  } else if (payment.type === "tokens" && payment.token_quantity) {
    const { error } = await admin.rpc("credit_tokens", {
      p_user_id: payment.user_id,
      p_amount: payment.token_quantity,
      p_reason: "purchase",
      p_payment_id: anchor,
    } as never);
    if (error) grantError = "credit_tokens failed";
  } else {
    grantError = "unknown payment type";
  }

  if (grantError) {
    /* Release the claim so the retry can grant. */
    await admin
      .from("payments")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    throw new Error(grantError);
  }

  logger.info("paddle_grant_completed", { orderRef: orderRef.slice(0, 40), type: payment.type });
  if (vipPlan) {
    (vipPlan.subscription
      ? notifySubscriptionActive(payment.user_id, vipPlan.name)
      : notifyVipGranted(payment.user_id)
    ).catch(() => {});
  } else if (payment.token_quantity) {
    notifyTokensPurchased(payment.user_id, payment.token_quantity).catch(() => {});
  }
  return NextResponse.json({ status: "granted" });
}

/* ── renewal (origin = subscription_recurring) ───────────────────── */
async function onRenewal(admin: Admin, txn: Transaction): Promise<NextResponse> {
  if (!txn.subscription_id || !txn.id) return NextResponse.json({ status: "ignored" });

  const { data: mapping } = await admin
    .from("paddle_customers")
    .select("user_id")
    .eq("subscription_id", txn.subscription_id)
    .maybeSingle();
  if (!mapping) {
    logger.warn("paddle_renewal_unmapped", { sub: txn.subscription_id.slice(0, 32) });
    return NextResponse.json({ status: "unmapped" });
  }

  const productId = productForPriceId(lineItems(txn)[0]?.priceId ?? "");
  const plan = productId ? getVipPlan(productId) : undefined;
  if (!plan || !plan.subscription) {
    logger.error("paddle_renewal_unknown_price", { sub: txn.subscription_id.slice(0, 32) });
    return NextResponse.json({ status: "unknown_price" });
  }

  /* One payments row per renewal transaction — txn ids are unique, so a
     re-fired renewal can never double-grant. */
  const orderRef = `pdl-renew-${txn.id}`;
  const { data: row, error: rowError } = await admin
    .from("payments")
    .upsert(
      {
        order_id: orderRef,
        user_id: mapping.user_id,
        type: "vip",
        status: "confirmed",
        amount: plan.priceUsd,
        currency: "usd",
        payment_id: txn.id,
      },
      { onConflict: "order_id", ignoreDuplicates: true },
    )
    .select("id");
  if (rowError) throw new Error("renewal row failed");
  if (!row || row.length === 0) return NextResponse.json({ status: "already_renewed" });

  const { error } = await admin.rpc("grant_vip", {
    p_user_id: mapping.user_id,
    p_days: plan.days,
    p_payment_id: txn.id,
  } as never);
  if (error) {
    await admin.from("payments").delete().eq("order_id", orderRef);
    throw new Error("renewal grant failed");
  }
  notifyVipGranted(mapping.user_id).catch(() => {});
  return NextResponse.json({ status: "renewed" });
}

/* ── subscription.* — status sync only ───────────────────────────── */
async function onSubscriptionChange(admin: Admin, sub: Subscription): Promise<NextResponse> {
  if (!sub.id) return NextResponse.json({ status: "ignored" });
  const { data } = await admin
    .from("paddle_customers")
    .update({ subscription_status: sub.status ?? null, updated_at: new Date().toISOString() })
    .eq("subscription_id", sub.id)
    .select("user_id");
  return NextResponse.json({ status: data && data.length ? "synced" : "unmapped" });
}

/* ── adjustment.* — refunds / chargebacks ────────────────────────── */
async function onAdjustment(admin: Admin, adj: Adjustment): Promise<NextResponse> {
  const isReversal = adj.action === "refund" || adj.action === "chargeback";
  if (!isReversal || adj.status !== "approved" || !adj.transaction_id) {
    return NextResponse.json({ status: "ignored" });
  }
  const { data } = await admin
    .from("payments")
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("payment_id", adj.transaction_id)
    .select("id, user_id, type, token_quantity");
  logger.warn("paddle_payment_reversed", {
    action: adj.action,
    txn: adj.transaction_id.slice(0, 32),
    rows: data?.length ?? 0,
  });
  return NextResponse.json({ status: "reversed" });
}
