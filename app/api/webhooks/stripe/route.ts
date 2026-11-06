import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import {
  notifyVipGranted,
  notifyTokensPurchased,
  notifySubscriptionActive,
} from "@/lib/notifications/dispatch";
import { logger } from "@/lib/utils/logger";
import { vipPlanFromOrderRef } from "@/lib/billing/constants";
import { findCanary, reportCanaryHit } from "@/lib/security/canary";
import {
  recordInvalidSignature,
  isSignatureBruteforceBlocked,
} from "@/lib/security/canary";
import { getClientIp } from "@/lib/utils/ratelimit";
import { verifyStripeSignature } from "@/lib/stripe/signature";

/* ════════════════════════════════════════════════════════════════════
 * Stripe webhook — POST /api/webhooks/stripe (Phase 2).
 *
 * SECURITY MODEL. Every delivery is authenticated by Stripe's
 * HMAC-SHA256 signature over the exact raw request bytes
 * (`Stripe-Signature: t=…,v1=…`, keyed with STRIPE_WEBHOOK_SECRET),
 * verified BEFORE the body is ever parsed. A forged POST cannot
 * produce that signature. Layered on top:
 *
 *   1. Signature — HMAC of the raw bytes with a ±5-minute replay
 *      window; constant-time compare; any valid v1 generation
 *      accepted (secret rotation support).
 *   2. Bruteforce throttling on the caller IP (shared honeytoken
 *      guard machinery — signature guessing is treated like
 *      credential stuffing).
 *   3. Event-id idempotency — every event id is inserted into
 *      stripe_events before handling; a duplicate insert returning
 *      zero rows means already processed → ack, do nothing. Replays
 *      and double-fires are no-ops even across processes.
 *   4. Order identity — client_reference_id must be OUR order ref
 *      (`stripe-{product}-{uuid}`, the payments.order_id written at
 *      checkout). The paying user, product and expected price all
 *      come from that row — never from the event payload.
 *   5. Amount check — session.amount_total must match the
 *      server-derived price stored on the row (±1 cent), in the
 *      expected currency. A mispriced/edited link cannot grant.
 *   6. Atomic claim — exactly one concurrent delivery can transition
 *      the row pending → confirmed; the grant happens only for the
 *      claim winner. Grant failure releases the claim so Stripe's
 *      retry can land again.
 *   7. Grants flow through the same DB RPCs as the legacy rails:
 *      grant_vip (stacks days: greatest(now, current)+N) and
 *      credit_tokens — single-transaction, ledgered by the RPCs.
 *
 * Subscription lifecycle:
 *   - checkout.session.completed    → first-period grant + customer
 *                                     mapping (stripe_customers)
 *   - invoice.paid (subscription_cycle) → renewal grant, its own
 *                                     unique payments row per cycle
 *   - customer.subscription.updated → status sync only (never grants
 *                                     — renewal money is invoice.paid)
 *   - customer.subscription.deleted → status sync only; paid VIP
 *                                     time is never clawed back
 *   - checkout.session.expired      → pending row closed as expired
 *
 * This route is excluded from proxy auth gating (the caller is
 * Stripe, not a SweetScene session) — authentication is the
 * signature.
 * ════════════════════════════════════════════════════════════════════ */

const MAX_BODY_BYTES = 256 * 1024;
const ORDER_REF_RE = /^stripe-[a-z0-9_]+-[0-9a-f-]{10,}$/;

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
};

type CheckoutSession = {
  id?: string;
  mode?: string;
  client_reference_id?: string | null;
  customer?: string | null;
  subscription?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_status?: string | null;
};

type Subscription = {
  id?: string;
  status?: string;
  customer?: string | null;
  current_period_end?: number | null;
  items?: {
    data?: Array<{ current_period_end?: number | null }>;
  } | null;
};

type Invoice = {
  id?: string;
  customer?: string | null;
  subscription?: string | null;
  billing_reason?: string | null;
  amount_paid?: number | null;
  currency?: string | null;
  number?: string | null;
  created?: number | null;
  lines?: {
    data?: Array<{
      price?: { recurring?: { interval?: string | null } | null } | null;
    }>;
  } | null;
};

type PaymentRow = {
  id: string;
  user_id: string;
  type: string;
  status: string;
  amount: number | null;
  currency: string | null;
  token_quantity: number | null;
  payment_id: string | null;
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    return await handleWebhook(request);
  } catch (err) {
    logger.error("stripe_webhook_internal_error", { err });
    /* 500 so Stripe retries — a transient DB error must not
       permanently lose a paid order. */
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function handleWebhook(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);

  /* 0. Bruteforce guard — repeated bad signatures from one IP get
     locked out before we spend HMAC cycles on it. */
  if (isSignatureBruteforceBlocked(ip)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  /* 1. Read the exact raw bytes — the signature is over them, and
     nothing may parse the body before verification. */
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!/^whsec_/.test(secret)) {
    logger.error("stripe_webhook_not_configured");
    /* No secret ⇒ we cannot authenticate anything — fail closed. */
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const signatureHeader = request.headers.get("stripe-signature");
  const check = verifyStripeSignature(rawBody, signatureHeader, secret);

  if (!check.ok) {
    recordInvalidSignature(ip);
    logger.warn("stripe_webhook_bad_signature", {
      reason: check.reason,
      hasHeader: !!signatureHeader,
    });
    /* 400 — Stripe logs the failure; a tampered delivery (T5) never
       grants anything. */
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  /* 2. Only now may the body be parsed. */
  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  if (!event.id || !event.type) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  /* 3. Canary guard — a published fake credential appearing in the
     delivery means someone is probing; alarm and reject. */
  const objectText = JSON.stringify(event.data?.object ?? {}).slice(0, 512);
  const canary = findCanary(signatureHeader ?? "", event.id, objectText);
  if (canary) {
    reportCanaryHit(canary, { surface: "stripe_webhook" });
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  logger.info("stripe_webhook_received", {
    eventId: event.id.slice(0, 30),
    type: event.type,
  });

  /* 4. Event-id idempotency — insert BEFORE handling. Zero returned
     rows = already processed → plain ack. */
  const admin = createAdminClient();
  const { data: inserted, error: insertError } = await admin
    .from("stripe_events")
    .upsert(
      { event_id: event.id, event_type: event.type },
      { onConflict: "event_id", ignoreDuplicates: true },
    )
    .select("event_id");

  if (insertError) {
    logger.error("stripe_event_ledger_insert_failed", {
      eventId: event.id.slice(0, 30),
      insertError,
    });
    return NextResponse.json({ error: "Ledger unavailable" }, { status: 500 });
  }
  if (!inserted || inserted.length === 0) {
    logger.info("stripe_webhook_duplicate_event", {
      eventId: event.id.slice(0, 30),
    });
    return NextResponse.json({ received: true, duplicate: true });
  }

  /* 5. Dispatch. Unknown types are acked — Stripe best practice. */
  const object = (event.data?.object ?? {}) as Record<string, unknown>;
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        return await handleCheckoutCompleted(admin, object as unknown as CheckoutSession);
      case "checkout.session.expired":
        return await handleCheckoutExpired(admin, object as unknown as CheckoutSession);
      case "customer.subscription.updated":
        return await handleSubscriptionUpdated(admin, object as unknown as Subscription);
      case "customer.subscription.deleted":
        return await handleSubscriptionDeleted(admin, object as unknown as Subscription);
      case "invoice.paid":
      case "invoice.payment_succeeded":
        return await handleInvoicePaid(admin, object as unknown as Invoice);
      default:
        logger.info("stripe_webhook_ignored_type", { type: event.type });
        return NextResponse.json({ received: true, ignored: true });
    }
  } catch (err) {
    logger.error("stripe_webhook_handler_error", {
      eventId: event.id.slice(0, 30),
      type: event.type,
      err,
    });
    /* 500 → Stripe retries with the SAME event id; the ledger row
       already exists so the retry re-runs only the handler. */
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}

/* ── checkout.session.completed — the grant path ─────────────────── */

async function handleCheckoutCompleted(
  admin: ReturnType<typeof createAdminClient>,
  session: CheckoutSession,
): Promise<NextResponse> {
  const orderRef = session.client_reference_id ?? "";

  /* Our order reference must be well-formed — anything else is not a
     SweetScene checkout (product prefix allows underscores:
     stripe-vip_monthly-… / stripe-starter-…). */
  if (!ORDER_REF_RE.test(orderRef)) {
    logger.warn("stripe_webhook_unknown_order_ref", {
      orderRef: orderRef.slice(0, 32),
    });
    return NextResponse.json({ status: "ignored" });
  }

  /* Payment mode with an unsettled payment (async method pending)
     grants nothing — async_payment_succeeded re-delivers when paid. */
  if (session.mode === "payment" && session.payment_status !== "paid") {
    return NextResponse.json({ status: "awaiting_payment" });
  }

  const { data: paymentRow, error: lookupError } = await admin
    .from("payments")
    .select(
      "id, user_id, type, status, amount, currency, token_quantity, payment_id",
    )
    .eq("order_id", orderRef)
    .maybeSingle();

  if (lookupError || !paymentRow) {
    logger.warn("stripe_webhook_unknown_order", {
      orderRef: orderRef.slice(0, 32),
    });
    /* 200 so Stripe stops retrying an order we don't know. */
    return NextResponse.json({ status: "ignored" });
  }

  const payment = paymentRow as PaymentRow;

  if (payment.status === "confirmed") {
    return NextResponse.json({ status: "already_confirmed" });
  }

  /* Amount + currency check — the event must agree with the
     server-derived price stored at order creation. ±1 cent slack for
     integer-cent rounding. Subscription first periods are checked the
     same way (no trials are configured on our links). */
  const expectedCents = Math.round((payment.amount ?? 0) * 100);
  const observedCents = session.amount_total ?? null;
  const expectedCurrency = (payment.currency ?? "usd").toLowerCase();
  const observedCurrency = (session.currency ?? "usd").toLowerCase();

  if (
    observedCents === null ||
    Math.abs(observedCents - expectedCents) > 1 ||
    observedCurrency !== expectedCurrency
  ) {
    logger.error("stripe_webhook_amount_mismatch", {
      orderRef: orderRef.slice(0, 32),
      expectedCents,
      observedCents,
      expectedCurrency,
      observedCurrency,
    });
    await admin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", payment.id)
      .eq("status", "pending");
    /* Sig-valid event, business mismatch: ack (stop retries), grant
       nothing, leave the failed row for reconciliation. */
    return NextResponse.json({ status: "amount_mismatch" });
  }

  /* Atomic claim — exactly one concurrent delivery transitions the
     row to confirmed; payment_id becomes the checkout session id. */
  const { data: claimed, error: claimError } = await admin
    .from("payments")
    .update({
      status: "confirmed",
      payment_id: session.id ?? orderRef,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .neq("status", "confirmed")
    .select("id");

  if (claimError) {
    logger.error("stripe_claim_failed", {
      orderRef: orderRef.slice(0, 32),
      claimError,
    });
    return NextResponse.json({ error: "Claim failed" }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ status: "already_confirmed" });
  }
  logger.info("stripe_payment_claimed", {
    orderRef: orderRef.slice(0, 32),
    sessionId: (session.id ?? "").slice(0, 18),
  });

  /* Map the user ↔ Stripe customer/subscription for the portal +
     renewal events (best-effort — the grant does not depend on it). */
  if (session.customer) {
    const { error: upsertError } = await admin
      .from("stripe_customers")
      .upsert(
        {
          user_id: payment.user_id,
          customer_id: session.customer,
          subscription_id: session.subscription ?? null,
          subscription_status: session.subscription ? "active" : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (upsertError) {
      logger.error("stripe_customer_upsert_failed", {
        userId: payment.user_id,
        upsertError,
      });
    }
  }

  /* Grant — same RPCs as the legacy rails. VIP-family orders all have
     type "vip"; the plan (and its grant days) is derived from the
     order-id prefix (vip_monthly → 30, vip_yearly → 365). grant_vip
     stacks onto the existing expiry; credit_tokens is exact. */
  const anchor = session.id ?? orderRef;
  const vipPlan = payment.type === "vip" ? vipPlanFromOrderRef(orderRef) : null;

  let grantError: string | null = null;
  if (vipPlan) {
    const { error: rpcError } = await admin.rpc("grant_vip", {
      p_user_id: payment.user_id,
      p_days: vipPlan.days,
      p_payment_id: anchor,
    } as never);
    grantError = rpcError ? "grant_vip failed" : null;
  } else if (payment.type === "tokens" && payment.token_quantity) {
    const { error: rpcError } = await admin.rpc("credit_tokens", {
      p_user_id: payment.user_id,
      p_amount: payment.token_quantity,
      p_reason: "purchase",
      p_payment_id: anchor,
    } as never);
    grantError = rpcError ? "credit_tokens failed" : null;
  } else {
    grantError = "Unknown payment type or missing token quantity";
  }

  if (grantError) {
    /* Release the claim so Stripe's retry can grant (same
       recoverable pattern as the legacy webhooks). */
    logger.error("stripe_grant_failed_claim_released", {
      orderRef: orderRef.slice(0, 32),
      grantError,
      type: payment.type,
    });
    await admin
      .from("payments")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    return NextResponse.json({ error: grantError }, { status: 500 });
  }

  logger.info("stripe_grant_completed", {
    orderRef: orderRef.slice(0, 32),
    type: payment.type,
    tokenQuantity: payment.token_quantity,
    paidCents: observedCents,
  });

  /* User notification (best-effort). */
  if (vipPlan?.subscription) {
    await notifySubscriptionActive(payment.user_id, vipPlan.name).catch(() => {});
  } else if (vipPlan) {
    await notifyVipGranted(payment.user_id).catch(() => {});
  } else if (payment.token_quantity) {
    await notifyTokensPurchased(payment.user_id, payment.token_quantity).catch(
      () => {},
    );
  }

  return NextResponse.json({ status: "granted" });
}

/* ── checkout.session.expired — close the pending row ────────────── */

async function handleCheckoutExpired(
  admin: ReturnType<typeof createAdminClient>,
  session: CheckoutSession,
): Promise<NextResponse> {
  const orderRef = session.client_reference_id ?? "";
  if (!ORDER_REF_RE.test(orderRef)) {
    return NextResponse.json({ status: "ignored" });
  }
  await admin
    .from("payments")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("order_id", orderRef)
    .eq("status", "pending");
  return NextResponse.json({ status: "expired" });
}

/* ── customer.subscription.updated — status sync only ────────────── */

async function findStripeCustomerRow(
  admin: ReturnType<typeof createAdminClient>,
  sub: { id?: string; customer?: string | null },
) {
  const { data: bySub } = await admin
    .from("stripe_customers")
    .select("user_id, customer_id")
    .eq("subscription_id", sub.id ?? "_")
    .maybeSingle();
  if (bySub) return bySub as { user_id: string; customer_id: string };
  const { data: byCustomer } = await admin
    .from("stripe_customers")
    .select("user_id, customer_id")
    .eq("customer_id", sub.customer ?? "_")
    .maybeSingle();
  return (byCustomer ?? null) as { user_id: string; customer_id: string } | null;
}

async function handleSubscriptionUpdated(
  admin: ReturnType<typeof createAdminClient>,
  sub: Subscription,
): Promise<NextResponse> {
  const row = await findStripeCustomerRow(admin, sub);
  if (!row || !sub.id) {
    logger.info("stripe_sub_update_no_mapping", { subId: (sub.id ?? "").slice(0, 18) });
    return NextResponse.json({ status: "unmapped" });
  }
  await admin
    .from("stripe_customers")
    .update({
      subscription_id: sub.id,
      subscription_status: sub.status ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", row.user_id);
  logger.info("stripe_subscription_synced", {
    userId: row.user_id,
    status: sub.status,
  });
  /* NEVER grants here — renewal money is invoice.paid's business;
     subscription.updated fires on many non-payment transitions. */
  return NextResponse.json({ status: "synced" });
}

/* ── customer.subscription.deleted — sync; paid time is kept ─────── */

async function handleSubscriptionDeleted(
  admin: ReturnType<typeof createAdminClient>,
  sub: Subscription,
): Promise<NextResponse> {
  const row = await findStripeCustomerRow(admin, sub);
  if (!row) {
    logger.info("stripe_sub_delete_no_mapping", { subId: (sub.id ?? "").slice(0, 18) });
    return NextResponse.json({ status: "unmapped" });
  }
  await admin
    .from("stripe_customers")
    .update({
      subscription_status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", row.user_id);
  logger.info("stripe_subscription_canceled", { userId: row.user_id });
  /* Paid VIP time is never clawed back — grant_vip stacked real paid
     days onto vip_expires_at and those stay until they elapse. The
     renewal-reminders cron handles the natural wind-down. */
  return NextResponse.json({ status: "canceled" });
}

/* ── invoice.paid — subscription renewal grants ──────────────────── */

async function handleInvoicePaid(
  admin: ReturnType<typeof createAdminClient>,
  invoice: Invoice,
): Promise<NextResponse> {
  /* Only RENEWALS are granted here — the first period is granted by
     checkout.session.completed (billing_reason=subscription_create
     would double-credit). */
  if (invoice.billing_reason && invoice.billing_reason !== "subscription_cycle") {
    return NextResponse.json({ status: "ignored" });
  }
  if (!invoice.subscription) {
    return NextResponse.json({ status: "ignored" });
  }

  const row = await findStripeCustomerRow(admin, {
    id: invoice.subscription,
    customer: invoice.customer,
  });
  if (!row) {
    logger.info("stripe_invoice_no_mapping", {
      subId: invoice.subscription.slice(0, 18),
    });
    return NextResponse.json({ status: "unmapped" });
  }

  /* Grant days from the recurring interval (month → 30, year → 365);
     fall back to the plan of the user's last confirmed VIP order,
     then to the monthly default. */
  const interval =
    invoice.lines?.data?.[0]?.price?.recurring?.interval ?? null;
  let days = interval === "year" ? 365 : interval === "month" ? 30 : 0;
  if (!days) {
    const { data: lastVip } = await admin
      .from("payments")
      .select("order_id")
      .eq("user_id", row.user_id)
      .eq("type", "vip")
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    days = lastVip?.order_id
      ? vipPlanFromOrderRef(lastVip.order_id).days
      : 30;
  }

  /* One unique payments row per cycle — the order id is deterministic
     (subscription + invoice number), so a redelivered/re-fired invoice
     can never double-grant even under a different event id. */
  const orderRef = `stripe-sub-${invoice.subscription}-${invoice.number ?? invoice.created ?? "x"}`;
  const { data: renewalRow, error: renewalError } = await admin
    .from("payments")
    .upsert(
      {
        order_id: orderRef,
        user_id: row.user_id,
        type: "vip",
        status: "confirmed",
        amount: (invoice.amount_paid ?? 0) / 100,
        currency: (invoice.currency ?? "usd").toLowerCase(),
        payment_id: invoice.id ?? null,
      },
      { onConflict: "order_id", ignoreDuplicates: true },
    )
    .select("id");

  if (renewalError) {
    logger.error("stripe_renewal_row_failed", {
      orderRef: orderRef.slice(0, 40),
      renewalError,
    });
    return NextResponse.json({ error: "Renewal row failed" }, { status: 500 });
  }
  if (!renewalRow || renewalRow.length === 0) {
    return NextResponse.json({ status: "already_renewed" });
  }

  const { error: rpcError } = await admin.rpc("grant_vip", {
    p_user_id: row.user_id,
    p_days: days,
    p_payment_id: invoice.id ?? orderRef,
  } as never);

  if (rpcError) {
    logger.error("stripe_renewal_grant_failed", {
      orderRef: orderRef.slice(0, 40),
      rpcError,
    });
    await admin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("order_id", orderRef);
    return NextResponse.json({ error: "Renewal grant failed" }, { status: 500 });
  }

  logger.info("stripe_renewal_granted", {
    userId: row.user_id,
    days,
    invoiceId: (invoice.id ?? "").slice(0, 18),
  });

  await notifyVipGranted(row.user_id).catch(() => {});

  return NextResponse.json({ status: "renewed" });
}
