import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import {
  getPaymentStatus,
  isAmountAcceptable,
  verifyWebhookSignature,
} from "@/lib/payram/server";
import {
  notifyVipGranted,
  notifyTokensPurchased,
} from "@/lib/notifications/dispatch";
import { logger } from "@/lib/utils/logger";
import { VIP_DURATION_DAYS } from "@/lib/billing/constants";
import {
  findCanary,
  reportCanaryHit,
} from "@/lib/security/canary";

/* ════════════════════════════════════════════════════════════════════
 * PayRam payment webhook — POST (the self-hosted gateway delivers
 * confirmation-progress events and the final fill state here).
 *
 * SECURITY MODEL. Every delivery is authenticated by PayRam's
 * HMAC-SHA256 signature over the raw body, keyed with the project
 * API key (X-Payram-Signature) — a forged POST cannot produce it.
 * Verification is therefore layered:
 *
 *   1. Signature — HMAC of the exact raw request bytes; a legacy
 *      plain API-KEY header is also accepted for older instances.
 *   2. Non-final statuses (OPEN / PARTIALLY_FILLED progress
 *      events) are acknowledged and ignored — only a fill grants.
 *   3. The gateway's own payment-status API is queried with the
 *      reference_id stored on the payments row at order creation and
 *      must agree (FILLED / OVER_FILLED) before anything is granted.
 *      A forger would have to fake our own gateway's API response,
 *      not just our URL.
 *   4. The paying customer (customer_id) must be the order's owner.
 *   5. The amount actually settled (filled_amount_in_usd) must be
 *      within tolerance of the order amount.
 *   6. The grant is guarded by an atomic claim on the payments row
 *      (pending → confirmed), exactly like the NOWPayments webhook —
 *      replays and double-fires are no-ops.
 *
 * This route is excluded from proxy auth gating (the caller is the
 * PayRam gateway, not a SweetScene session) — authentication is the
 * signature + the status-API cross-check.
 * ════════════════════════════════════════════════════════════════════ */

const TXID_RE = /^0x[a-fA-F0-9]{10,}$/;

type PayRamWebhookBody = {
  customer_id?: string;
  invoice_id?: string;
  reference_id?: string;
  status?: string;
  amount?: string;
  currency?: string;
  filled_amount_in_usd?: string | null;
  payment_info?: {
    transaction_hash?: string;
    source_address?: string;
    destination_address?: string;
  }[];
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    return await handleWebhook(request);
  } catch (err) {
    logger.error("payram_webhook_internal_error", { err });
    /* 500 so the gateway retries — a transient DB error must not
       permanently lose a paid order. */
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function handleWebhook(request: Request): Promise<NextResponse> {
  /* 1. Authenticate the delivery — HMAC over the exact raw bytes. */
  const rawBody = await request.text();
  const signature = request.headers.get("x-payram-signature");
  const apiKeyHeader = request.headers.get("api-key");

  if (!verifyWebhookSignature(rawBody, signature, apiKeyHeader)) {
    logger.warn("payram_webhook_bad_signature", {
      hasSignature: !!signature,
      hasApiKeyHeader: !!apiKeyHeader,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: PayRamWebhookBody;
  try {
    body = JSON.parse(rawBody) as PayRamWebhookBody;
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const invoiceId = body.invoice_id ?? "";
  const referenceId = body.reference_id ?? "";
  const status = body.status ?? "";
  const txHash = body.payment_info?.[0]?.transaction_hash ?? "";

  /* Canary guard — a published fake credential appearing here means
     someone is probing; alarm and reject. */
  const canary = findCanary(
    invoiceId,
    referenceId,
    txHash,
    body.payment_info?.[0]?.source_address ?? "",
    body.payment_info?.[0]?.destination_address ?? ""
  );
  if (canary) {
    reportCanaryHit(canary, { surface: "payram_webhook" });
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  logger.info("payram_webhook_received", {
    invoiceId: invoiceId.slice(0, 24),
    status,
    hasTx: !!txHash,
  });

  /* 2. Our order reference must be well-formed. */
  if (!invoiceId || !/^pr-[a-z]+-[0-9a-f-]{10,}$/.test(invoiceId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  /* 3. Non-final events — acknowledge quickly, never grant.
     PARTIALLY_FILLED means the customer is still paying toward the
     amount; the final webhook carries FILLED / OVER_FILLED. */
  if (status === "OPEN" || status === "PARTIALLY_FILLED") {
    return NextResponse.json({ status: "acknowledged" });
  }

  const admin = createAdminClient();

  /* 4. Expired links close their order out. */
  if (status === "CANCELLED") {
    await admin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("order_id", invoiceId)
      .eq("status", "pending");
    return NextResponse.json({ status: "cancelled" });
  }

  if (status !== "FILLED" && status !== "OVER_FILLED") {
    logger.warn("payram_webhook_unknown_status", { status });
    /* Unknown status — ack so the gateway stops retrying, but grant
       nothing. Reconciliation happens via the status API. */
    return NextResponse.json({ status: "ignored" });
  }

  /* ── FILLED / OVER_FILLED — the grant path ── */

  const { data: paymentRow, error: lookupError } = await admin
    .from("payments")
    .select("id, user_id, type, status, amount, token_quantity, payment_id")
    .eq("order_id", invoiceId)
    .maybeSingle();

  if (lookupError || !paymentRow) {
    logger.warn("payram_webhook_unknown_order", {
      invoiceId: invoiceId.slice(0, 24),
    });
    /* 200 so the gateway doesn't hammer retries on an order we don't
       know. */
    return NextResponse.json({ status: "ignored" });
  }

  const payment = paymentRow as {
    id: string;
    user_id: string;
    type: string;
    status: string;
    amount: number;
    token_quantity: number | null;
    payment_id: string | null;
  };

  if (payment.status === "confirmed") {
    logger.info("payram_webhook_already_confirmed", {
      invoiceId: invoiceId.slice(0, 24),
    });
    return NextResponse.json({ status: "already_confirmed" });
  }

  /* 5. Cross-check with the gateway's own status API using the
        reference_id stored at order creation. */
  const storedRef = payment.payment_id;
  if (!storedRef || !referenceId) {
    logger.error("payram_webhook_missing_reference", {
      invoiceId: invoiceId.slice(0, 24),
    });
    return NextResponse.json({ error: "Order state invalid" }, { status: 500 });
  }

  let gatewayStatus: Awaited<ReturnType<typeof getPaymentStatus>>;
  try {
    gatewayStatus = await getPaymentStatus(storedRef);
  } catch (err) {
    logger.warn("payram_webhook_status_check_failed", {
      invoiceId: invoiceId.slice(0, 24),
      err,
    });
    /* The gateway API can lag behind the webhook; retry-friendly 503. */
    return NextResponse.json({ error: "Status check failed" }, { status: 503 });
  }

  if (
    gatewayStatus.paymentState !== "FILLED" &&
    gatewayStatus.paymentState !== "OVER_FILLED"
  ) {
    logger.warn("payram_webhook_status_not_filled", {
      invoiceId: invoiceId.slice(0, 24),
      observed: gatewayStatus.paymentState,
    });
    return NextResponse.json(
      { status: "payment_not_confirmed", observed: gatewayStatus.paymentState },
      { status: 503 }
    );
  }

  /* 6. The paying customer must be the order's owner. */
  if (body.customer_id !== payment.user_id) {
    logger.warn("payram_webhook_customer_mismatch", {
      invoiceId: invoiceId.slice(0, 24),
    });
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  /* 7. Amount sanity — the USD value actually settled must cover the
        order. */
  const paid = Number(
    body.filled_amount_in_usd ?? gatewayStatus.amountInUSD ?? body.amount
  );
  if (!isAmountAcceptable(payment.amount, paid)) {
    logger.error("payram_webhook_underpaid", {
      invoiceId: invoiceId.slice(0, 24),
      expected: payment.amount,
      paid,
    });
    await admin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    return NextResponse.json({ status: "underpaid", expected: payment.amount, paid });
  }

  /* 8. Atomic claim — exactly one concurrent request can transition
        the row to confirmed. payment_id becomes the on-chain deposit
        tx hash when present, else the PayRam reference. */
  const paymentAnchor = TXID_RE.test(txHash) ? txHash : `payram-${referenceId}`;

  const { data: claimed, error: claimError } = await admin
    .from("payments")
    .update({
      status: "confirmed",
      payment_id: paymentAnchor,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .neq("status", "confirmed")
    .select("id");

  if (claimError) {
    logger.error("payram_claim_failed", {
      invoiceId: invoiceId.slice(0, 24),
      claimError,
    });
    return NextResponse.json({ error: "Claim failed" }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    logger.info("payram_claim_skipped_already_processed", {
      invoiceId: invoiceId.slice(0, 24),
    });
    return NextResponse.json({ status: "already_confirmed" });
  }
  logger.info("payram_payment_claimed", {
    invoiceId: invoiceId.slice(0, 24),
    paymentRowId: payment.id,
    anchor: paymentAnchor.slice(0, 16),
  });

  /* 9. Grant — identical RPCs to the NOWPayments path. */
  let grantError: string | null = null;
  if (payment.type === "vip") {
    const { error: rpcError } = await admin.rpc("grant_vip", {
      p_user_id: payment.user_id,
      p_days: VIP_DURATION_DAYS,
      p_payment_id: paymentAnchor,
    } as never);
    grantError = rpcError ? "grant_vip failed" : null;
  } else if (payment.type === "tokens" && payment.token_quantity) {
    const { error: rpcError } = await admin.rpc("credit_tokens", {
      p_user_id: payment.user_id,
      p_amount: payment.token_quantity,
      p_reason: "purchase",
      p_payment_id: paymentAnchor,
    } as never);
    grantError = rpcError ? "credit_tokens failed" : null;
  } else {
    grantError = "Unknown payment type or missing token quantity";
  }

  if (grantError) {
    /* Release the claim so a retry can grant (same recoverable
       pattern as the NOWPayments webhook). */
    logger.error("payram_grant_failed_claim_released", {
      invoiceId: invoiceId.slice(0, 24),
      grantError,
      type: payment.type,
    });
    await admin
      .from("payments")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    return NextResponse.json({ error: grantError }, { status: 500 });
  }

  logger.info("payram_grant_completed", {
    invoiceId: invoiceId.slice(0, 24),
    type: payment.type,
    tokenQuantity: payment.token_quantity,
    paidUsd: paid,
  });

  /* 10. User notification (best-effort). */
  if (payment.type === "vip") {
    await notifyVipGranted(payment.user_id).catch(() => {});
  } else if (payment.token_quantity) {
    await notifyTokensPurchased(payment.user_id, payment.token_quantity).catch(
      () => {}
    );
  }

  logger.info("payram_webhook_complete", { invoiceId: invoiceId.slice(0, 24) });
  return NextResponse.json({ status: "ok" });
}
