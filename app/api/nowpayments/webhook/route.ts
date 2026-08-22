import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { verifyWebhookSignature, getPaymentStatus } from "@/lib/nowpayments/server";
import {
  notifyVipGranted,
  notifyTokensPurchased,
} from "@/lib/notifications/dispatch";
import { VIP_DURATION_DAYS } from "@/lib/billing/constants";

/* ════════════════════════════════════════════════════════════════════
 * Phase 8 — NOWPayments IPN webhook handler.
 *
 * URL: /api/nowpayments/webhook
 *
 * ORDERING IS SAFETY-CRITICAL. Every side effect happens only after all
 * read-only validation has passed, and the grant is guarded by an atomic
 * claim on the `payments` row rather than by the event ledger.
 *
 *   1. Cap body size, verify HMAC-SHA512 signature.
 *   2. Parse payload, validate order/payment IDs.
 *   3. Ignore non-confirmed lifecycle events (waiting, sending, …).
 *   4. Look up the payment row by order_id.
 *   5. Cross-check status against the NOWPayments API (read-only).
 *   6. Verify the amount actually paid, in the currency it was paid in.
 *   7. ATOMICALLY claim the payment row (pending → confirmed).
 *   8. Grant VIP or tokens. On failure, release the claim and 500.
 *   9. Record the event in the audit ledger, notify the user.
 *
 * Why the claim, and not the event ledger, is the idempotency guard:
 * the ledger was previously written at step 4, so ANY later failure —
 * NOWPayments' own API lagging, a missing payment row, a transient RPC
 * error — left a ledger row behind that made every retry short-circuit
 * to "already_processed". The user had paid and would never be granted
 * anything. The claim moves the guard onto the resource that actually
 * must not be double-spent, and releases it if the grant fails, so
 * retries are genuinely retryable.
 *
 * This route is excluded from proxy.ts auth gating (the matcher
 * excludes /api/ routes). Authentication is via the webhook signature.
 * ════════════════════════════════════════════════════════════════════ */

/** Pattern for NOWPayments payment IDs (alphanumeric + hyphen). */
const PAYMENT_ID_RE = /^[a-zA-Z0-9-]+$/;

/** Reject oversized bodies before parsing (IPN payloads are ~1 KB). */
const MAX_BODY_BYTES = 64 * 1024;

/** Lifecycle values that mean "the money has arrived". */
const CONFIRMED_STATES = new Set(["confirmed", "payment_confirmed", "finished"]);

/**
 * Tolerance for underpayment, as a fraction of the expected crypto
 * amount. Exchange-rate drift and network fees mean the amount that
 * lands is rarely exact to the last decimal; 1% is the usual allowance.
 */
const UNDERPAY_TOLERANCE = 0.01;

type PaymentRow = {
  id: string;
  user_id: string;
  type: string;
  status: string;
  token_quantity: number | null;
};

/**
 * Handles NOWPayments IPN POST callbacks. Verifies the signature,
 * cross-checks against the NOWPayments API, then atomically claims and
 * grants. Returns 5xx on transient failures so NOWPayments retries.
 *
 * @param request - The incoming POST request with the IPN payload.
 * @returns 200 on success/ignored, 400 on bad request, 5xx to retry.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    return await handleWebhook(request);
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Internal webhook processing — separated from POST so a top-level
 * catch can return 500 for any uncaught exception (enabling NOWPayments
 * to retry).
 */
async function handleWebhook(request: Request): Promise<NextResponse> {
  /* 0. Bound the body before reading it into memory. */
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const signatureHeader = request.headers.get("x-nowpayments-sig");

  /* 1. Verify signature. A throw here means the IPN secret is unset —
        that is a server misconfiguration, not a bad request, so return
        500 and let NOWPayments retry once it is fixed. */
  let isValid: boolean;
  try {
    isValid = await verifyWebhookSignature(rawBody, signatureHeader);
  } catch {
    return NextResponse.json(
      { error: "Signature verification unavailable" },
      { status: 500 }
    );
  }

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  /* 2. Parse the payload. */
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = typeof payload["payment_status"] === "string"
    ? (payload["payment_status"] as string)
    : "";
  const orderId = typeof payload["order_id"] === "string"
    ? (payload["order_id"] as string)
    : "";
  const paymentId = typeof payload["payment_id"] === "string"
    ? (payload["payment_id"] as string)
    : String(payload["payment_id"] ?? "");

  if (!orderId || !paymentId) {
    return NextResponse.json({ error: "Missing order/payment ID" }, { status: 400 });
  }

  /* BUG 7: validate paymentId to prevent URL injection — it is
     interpolated into the GET /payment/{id} path below. */
  if (!PAYMENT_ID_RE.test(paymentId)) {
    return NextResponse.json({ error: "Invalid payment ID format" }, { status: 400 });
  }

  /* 3. Ignore non-confirmed lifecycle events. NOWPayments sends several
        events (waiting, sending, confirmed, finished, …) for the same
        payment. Acknowledge with 200 so they aren't retried, and record
        nothing — a "waiting" event must never block a later grant. */
  if (!CONFIRMED_STATES.has(eventType)) {
    return NextResponse.json({ status: "ignored", event_type: eventType });
  }

  const admin = createAdminClient();

  /* 4. Look up the payment by order_id. Return 500 (not 404) so
        NOWPayments retries — the row may not be visible yet if the IPN
        beats the billing action's insert. */
  const { data, error: paymentError } = await admin
    .from("payments")
    .select("id, user_id, type, status, token_quantity")
    .eq("order_id", orderId)
    .maybeSingle();

  if (paymentError || !data) {
    return NextResponse.json({ error: "Payment not found" }, { status: 500 });
  }

  const payment = data as unknown as PaymentRow;

  /* Fast path — already granted. */
  if (payment.status === "confirmed") {
    return NextResponse.json({ status: "already_confirmed" });
  }

  /* 5. Cross-check against NOWPayments server-side as defence in depth,
        so a replayed or crafted payload cannot grant on its own. */
  let status: Awaited<ReturnType<typeof getPaymentStatus>>;
  try {
    status = await getPaymentStatus(paymentId);
  } catch {
    return NextResponse.json({ error: "Status check failed" }, { status: 503 });
  }

  /* Their API can lag behind the IPN it just sent. Return 503 so the
     webhook is retried; returning 200 here previously dropped the
     payment permanently. */
  if (!CONFIRMED_STATES.has(status.payment_status)) {
    return NextResponse.json(
      { status: "payment_not_confirmed", observed: status.payment_status },
      { status: 503 }
    );
  }

  /* 6. E19: underpayment check.
        Both values must be in the SAME currency. `actually_paid` and
        `pay_amount` are both denominated in `pay_currency` (the crypto
        the user sent). Comparing `actually_paid` against the stored
        fiat `payments.amount` — as this previously did — compared e.g.
        0.0025 ETH against 9.99 USD, so every honest payment tripped the
        underpaid branch and was marked failed. */
  const expected = Number(status.pay_amount);
  const paid = Number(status.actually_paid);

  if (Number.isFinite(expected) && expected > 0 && Number.isFinite(paid)) {
    if (paid < expected * (1 - UNDERPAY_TOLERANCE)) {
      await admin
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", payment.id);
      return NextResponse.json(
        { status: "underpaid", expected, paid },
        { status: 200 }
      );
    }
  }

  /* 7. Atomically claim the payment. The `.neq("status", "confirmed")`
        predicate is evaluated by Postgres as part of the UPDATE, so
        exactly one concurrent request can transition the row. If no row
        comes back, another request already claimed it.

        `neq` rather than `eq("status","pending")`: a row can legitimately
        be 'expired' (superseded by a newer top-up order) or 'failed' (a
        previous grant attempt) and still deserve a grant when the user
        pays that invoice. Only 'confirmed' must block. */
  const { data: claimed, error: claimError } = await admin
    .from("payments")
    .update({
      status: "confirmed",
      payment_id: paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .neq("status", "confirmed")
    .select("id");

  if (claimError) {
    return NextResponse.json({ error: "Claim failed" }, { status: 500 });
  }

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ status: "already_confirmed" });
  }

  /* 8. Grant. We hold the claim, so this runs exactly once. */
  let grantError: string | null = null;

  if (payment.type === "vip") {
    const { error: rpcError } = await admin.rpc("grant_vip", {
      p_user_id: payment.user_id,
      p_days: VIP_DURATION_DAYS,
      p_payment_id: paymentId,
    } as never);
    grantError = rpcError ? "grant_vip failed" : null;
  } else if (payment.type === "tokens" && payment.token_quantity) {
    const { error: rpcError } = await admin.rpc("credit_tokens", {
      p_user_id: payment.user_id,
      p_amount: payment.token_quantity,
      p_reason: "purchase",
      p_payment_id: paymentId,
    } as never);
    grantError = rpcError ? "credit_tokens failed" : null;
  } else {
    grantError = "Unknown payment type or missing token quantity";
  }

  if (grantError) {
    /* Release the claim so the retry can grant. Returning the row to
       'pending' is what makes this recoverable: the old code left it
       claimed and the ledger written, so the user's money vanished into
       a permanently un-retryable state. */
    await admin
      .from("payments")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    return NextResponse.json({ error: grantError }, { status: 500 });
  }

  /* 9. Audit ledger + user notification. Both are best-effort: the
        money has already been granted and must not be rolled back
        because a log write or a notification failed. */
  await admin
    .from("nowpayments_events")
    .insert({
      event_id: `${orderId}:${paymentId}:${eventType}`,
      event_type: eventType,
      payload: payload as never,
    })
    .then(
      () => {},
      () => {}
    );

  if (payment.type === "vip") {
    await notifyVipGranted(payment.user_id).catch(() => {});
  } else if (payment.token_quantity) {
    await notifyTokensPurchased(payment.user_id, payment.token_quantity).catch(
      () => {}
    );
  }

  return NextResponse.json({ status: "ok" });
}
