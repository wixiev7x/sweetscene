import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/* ════════════════════════════════════════════════════════════════════
 * PayRam client (server-only) — card / Apple Pay / Google Pay in via
 * PayRam's card-to-crypto onramp (the customer pays fiat into their
 * self-custody PayRam Wallet, then settles the order), USDC out on
 * Base to the merchant wallet configured on the gateway. PayRam is
 * self-hosted — no signup, no KYB, the project API key IS the
 * credential.
 *
 * Docs: https://docs.payram.com — Create Payment / Webhook /
 * Payment Status.
 *
 * Flow implemented here:
 *   1. createPayment() — POST /api/v1/payment with the project API
 *      key; returns the hosted payment page URL (full-page redirect
 *      only, never an iframe) plus PayRam's reference_id, stored on
 *      the payments row for webhook cross-checks.
 *   2. verifyWebhookSignature() — every webhook delivery is signed
 *      (X-Payram-Signature: sha256=HMAC-SHA256(raw body, API key)).
 *      The signature replaces all callback secrets.
 *   3. getPaymentStatus() — GET /api/v1/payment/reference/{id}. The
 *      webhook is the primary notification channel; this is used to
 *      CROSS-CHECK each fill so a forged webhook cannot grant on its
 *      own.
 * ════════════════════════════════════════════════════════════════════ */

/** Maximum allowed drift between the expected order amount and the
 *  USD value the gateway actually settled (fees/rate slippage). */
const AMOUNT_TOLERANCE = 0.10;

const FETCH_TIMEOUT_MS = 15_000;

export type PayRamPayment = {
  /** PayRam's unique reference for the payment — the webhook and
   *  status-polling key. */
  referenceId: string;
  /** Customer-facing hosted checkout page. */
  paymentUrl: string;
};

export type PayRamConfig = {
  apiBase: string;
  apiKey: string;
};

/** The self-hosted gateway's site URL (Settings → Site URL in the
 *  PayRam dashboard) plus the project API key. Fails closed when
 *  either is unset or malformed. */
export function getPayRamConfig(): PayRamConfig | null {
  const apiBase = process.env.PAYRAM_API_BASE?.replace(/\/+$/, "");
  const apiKey = process.env.PAYRAM_API_KEY;
  if (!apiBase || !/^https?:\/\//.test(apiBase) || !apiKey) return null;
  return { apiBase, apiKey };
}

export function isPayRamConfigured(): boolean {
  return getPayRamConfig() !== null;
}

function requireConfig(): PayRamConfig {
  const config = getPayRamConfig();
  if (!config) {
    throw new Error(
      "PayRam is not configured — set PAYRAM_API_BASE and PAYRAM_API_KEY"
    );
  }
  return config;
}

/**
 * Step 1 — create a payment. `invoiceID` carries OUR order reference
 * and is echoed back on every webhook for that payment; `customerID`
 * is the paying user's id, re-verified on the webhook before any
 * grant.
 */
export async function createPayment(params: {
  orderRef: string;
  customerId: string;
  customerEmail: string;
  amountUsd: number;
}): Promise<PayRamPayment> {
  const { apiBase, apiKey } = requireConfig();

  const res = await fetch(`${apiBase}/api/v1/payment`, {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      customerEmail: params.customerEmail,
      customerID: params.customerId,
      amountInUSD: params.amountUsd,
      invoiceID: params.orderRef,
    }),
  });
  if (!res.ok) {
    throw new Error(`PayRam payment creation failed: ${res.status}`);
  }
  const data = (await res.json()) as { reference_id?: string; url?: string };
  if (!data.reference_id || !data.url) {
    throw new Error("PayRam payment response missing required fields");
  }
  return { referenceId: data.reference_id, paymentUrl: data.url };
}

/**
 * Webhook signature verification. PayRam signs the exact raw request
 * body with the project API key:
 *   X-Payram-Signature: sha256=<hex HMAC-SHA256>
 * A legacy `API-KEY` header (the key sent verbatim) is also accepted
 * for instances that predate signature support. Anything else fails.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  apiKeyHeader: string | null
): boolean {
  const { apiKey } = requireConfig();

  if (signatureHeader) {
    const expected =
      "sha256=" + createHmac("sha256", apiKey).update(rawBody).digest("hex");
    const given = Buffer.from(signatureHeader);
    const want = Buffer.from(expected);
    return given.length === want.length && timingSafeEqual(given, want);
  }
  if (apiKeyHeader) {
    const given = Buffer.from(apiKeyHeader);
    const want = Buffer.from(apiKey);
    return given.length === want.length && timingSafeEqual(given, want);
  }
  return false;
}

export type PayRamPaymentStatus = {
  paymentState?:
    | "OPEN"
    | "PARTIALLY_FILLED"
    | "FILLED"
    | "OVER_FILLED"
    | "CANCELLED"
    | string;
  amountInUSD?: string;
  referenceID?: string;
  invoiceID?: string;
  customerID?: string;
};

/**
 * Payment status lookup by PayRam reference_id. Cross-check use only —
 * the signed webhook is the primary notification channel.
 */
export async function getPaymentStatus(
  referenceId: string
): Promise<PayRamPaymentStatus> {
  const { apiBase, apiKey } = requireConfig();
  const res = await fetch(
    `${apiBase}/api/v1/payment/reference/${encodeURIComponent(referenceId)}`,
    {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "API-Key": apiKey, Accept: "application/json" },
    }
  );
  if (!res.ok) {
    throw new Error(`PayRam status check failed: ${res.status}`);
  }
  return (await res.json()) as PayRamPaymentStatus;
}

/**
 * Amount sanity check — did the customer actually pay (roughly) the
 * order amount? Generous tolerance for fees/rate drift.
 */
export function isAmountAcceptable(
  expectedUsd: number,
  paidUsd: number
): boolean {
  if (!Number.isFinite(expectedUsd) || expectedUsd <= 0) return false;
  if (!Number.isFinite(paidUsd)) return false;
  return paidUsd >= expectedUsd * (1 - AMOUNT_TOLERANCE);
}
