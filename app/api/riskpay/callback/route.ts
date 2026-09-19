import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { getPaymentStatus, isAmountAcceptable } from "@/lib/riskpay/server";
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
 * RiskPay payment callback — GET (RiskPay's bot hits our callback URL
 * with the order's original params + payment data when the customer
 * pays).
 *
 * SECURITY MODEL. RiskPay callbacks carry NO signature (no API keys
 * exist in their model), so a forged GET could otherwise grant free
 * items. Verification is therefore layered:
 *
 *   1. The callback URL contains a per-order random secret (`t`) —
 *      stored NOWHERE public, unguessable. No matching order+secret
 *      ⇒ ignored.
 *   2. RiskPay's own payment-status API is queried with the order's
 *      ipn_token (stored on the payments row at wallet creation) and
 *      must report status=paid AND the same payout txid as the
 *      callback claims. A forger would have to fake RiskPay's own
 *      API response, not just our URL.
 *   3. The amount actually paid (value_coin) must be within tolerance
 *      of the order amount.
 *   4. The grant is guarded by an atomic claim on the payments row
 *      (pending → confirmed), exactly like the NOWPayments webhook —
 *      replays and double-fires are no-ops.
 *
 * This route is excluded from proxy auth gating (the caller is
 * RiskPay's bot, not a SweetScene session) — authentication is the
 * callback secret + the status-API cross-check.
 * ════════════════════════════════════════════════════════════════════ */

const TXID_RE = /^0x[a-fA-F0-9]{10,}$/;

export async function GET(request: Request): Promise<NextResponse> {
  try {
    return await handleCallback(request);
  } catch (err) {
    logger.error("rp_callback_internal_error", { err });
    /* 500 so RiskPay's bot retries — a transient DB error must not
       permanently lose a paid order. */
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function handleCallback(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref") ?? "";
  const secret = url.searchParams.get("t") ?? "";
  const valueCoin = Number(url.searchParams.get("value_coin") ?? "");
  const coin = url.searchParams.get("coin") ?? "";
  const txidIn = url.searchParams.get("txid_in") ?? "";
  const txidOut = url.searchParams.get("txid_out") ?? "";
  const addressIn = url.searchParams.get("address_in") ?? "";

  /* Canary guard — a published fake credential appearing here means
     someone is probing; alarm and reject. */
  const canary = findCanary(ref, secret, txidIn, txidOut, addressIn);
  if (canary) {
    reportCanaryHit(canary, { surface: "riskpay_callback" });
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  logger.info("rp_callback_received", {
    ref: ref.slice(0, 24),
    valueCoin,
    coin,
    hasTxids: !!txidIn && !!txidOut,
  });

  /* 1. Order + callback secret must match a pending payment. */
  if (!ref || !secret || !/^rp-[a-z]+-[0-9a-f-]{10,}$/.test(ref)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: paymentRow, error: lookupError } = await admin
    .from("payments")
    .select("id, user_id, type, status, amount, token_quantity, payment_id")
    .eq("order_id", ref)
    .maybeSingle();

  if (lookupError || !paymentRow) {
    logger.warn("rp_callback_unknown_order", { ref: ref.slice(0, 24) });
    /* 200 so the bot doesn't hammer retries on an order we don't know. */
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
    logger.info("rp_callback_already_confirmed", { ref: ref.slice(0, 24) });
    return NextResponse.json({ status: "already_confirmed" });
  }

  /* 2. Cross-check with RiskPay's own status API using the ipn_token
        stored at wallet creation. status must be paid AND the payout
        txid must match the callback's txid_out. */
  const ipnToken = payment.payment_id;
  if (!ipnToken) {
    logger.error("rp_callback_missing_ipn_token", { ref: ref.slice(0, 24) });
    return NextResponse.json({ error: "Order state invalid" }, { status: 500 });
  }

  let status: Awaited<ReturnType<typeof getPaymentStatus>>;
  try {
    status = await getPaymentStatus(ipnToken);
  } catch (err) {
    logger.warn("rp_callback_status_check_failed", {
      ref: ref.slice(0, 24),
      err,
    });
    /* Their API can lag behind the callback; retry-friendly 503. */
    return NextResponse.json({ error: "Status check failed" }, { status: 503 });
  }

  if (status.status !== "paid") {
    logger.warn("rp_callback_status_unpaid", {
      ref: ref.slice(0, 24),
      observed: status.status,
    });
    return NextResponse.json(
      { status: "payment_not_confirmed", observed: status.status },
      { status: 503 }
    );
  }

  if (!status.txid_out || !TXID_RE.test(txidOut) || status.txid_out !== txidOut) {
    logger.warn("rp_callback_txid_mismatch", {
      ref: ref.slice(0, 24),
      statusTxid: (status.txid_out ?? "").slice(0, 12),
      callbackTxid: txidOut.slice(0, 12),
    });
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  /* 3. Amount sanity — the USDC actually sent must cover the order. */
  const paid = Number(status.value_coin ?? valueCoin);
  if (!isAmountAcceptable(payment.amount, paid)) {
    logger.error("rp_callback_underpaid", {
      ref: ref.slice(0, 24),
      expected: payment.amount,
      paid,
    });
    await admin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    return NextResponse.json({ status: "underpaid", expected: payment.amount, paid });
  }

  /* 4. Atomic claim — exactly one concurrent request can transition
        the row to confirmed. */
  const { data: claimed, error: claimError } = await admin
    .from("payments")
    .update({
      status: "confirmed",
      payment_id: txidOut,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .neq("status", "confirmed")
    .select("id");

  if (claimError) {
    logger.error("rp_claim_failed", { ref: ref.slice(0, 24), claimError });
    return NextResponse.json({ error: "Claim failed" }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    logger.info("rp_claim_skipped_already_processed", { ref: ref.slice(0, 24) });
    return NextResponse.json({ status: "already_confirmed" });
  }
  logger.info("rp_payment_claimed", {
    ref: ref.slice(0, 24),
    paymentRowId: payment.id,
    txidOut: txidOut.slice(0, 14),
  });

  /* 5. Grant — identical RPCs to the NOWPayments path. */
  let grantError: string | null = null;
  if (payment.type === "vip") {
    const { error: rpcError } = await admin.rpc("grant_vip", {
      p_user_id: payment.user_id,
      p_days: VIP_DURATION_DAYS,
      p_payment_id: txidOut,
    } as never);
    grantError = rpcError ? "grant_vip failed" : null;
  } else if (payment.type === "tokens" && payment.token_quantity) {
    const { error: rpcError } = await admin.rpc("credit_tokens", {
      p_user_id: payment.user_id,
      p_amount: payment.token_quantity,
      p_reason: "purchase",
      p_payment_id: txidOut,
    } as never);
    grantError = rpcError ? "credit_tokens failed" : null;
  } else {
    grantError = "Unknown payment type or missing token quantity";
  }

  if (grantError) {
    /* Release the claim so a retry can grant (same recoverable
       pattern as the NOWPayments webhook). */
    logger.error("rp_grant_failed_claim_released", {
      ref: ref.slice(0, 24),
      grantError,
      type: payment.type,
    });
    await admin
      .from("payments")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    return NextResponse.json({ error: grantError }, { status: 500 });
  }

  logger.info("rp_grant_completed", {
    ref: ref.slice(0, 24),
    type: payment.type,
    tokenQuantity: payment.token_quantity,
    valueCoin: paid,
    coin,
  });

  /* 6. User notification (best-effort). */
  if (payment.type === "vip") {
    await notifyVipGranted(payment.user_id).catch(() => {});
  } else if (payment.token_quantity) {
    await notifyTokensPurchased(payment.user_id, payment.token_quantity).catch(
      () => {}
    );
  }

  logger.info("rp_callback_complete", { ref: ref.slice(0, 24) });
  return NextResponse.json({ status: "ok" });
}
