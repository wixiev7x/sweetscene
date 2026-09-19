import "server-only";

/* ════════════════════════════════════════════════════════════════════
 * RiskPay client (server-only) — fiat in (cards/PayPal/bank via the
 * customer's chosen provider), instant USDC (Polygon) out to the
 * merchant wallet. No API keys — the merchant wallet address IS the
 * account.
 *
 * Docs (Postman): https://documenter.getpostman.com/view/2104539/2sB2cPkRGz
 *
 * Flow implemented here:
 *   1. createTemporaryWallet() — registers our payout wallet + a
 *      per-order callback URL; returns the encrypted address_in used
 *      as the payment identifier, the plaintext polygon_address_in
 *      (for callback verification), and an ipn_token (for status
 *      polling / defence-in-depth cross-checks).
 *   2. buildPaymentUrl() — the customer-facing checkout URL. The
 *      multi-provider gateway (payment-creating.php) lets the
 *      customer pick card / PayPal / bank / etc. No iframes allowed —
 *      full redirect only.
 *   3. getPaymentStatus() — paid/unpaid + value + payout txid. Docs
 *      say casual use only (rate limits) — the callback is the
 *      primary notification; this is used to CROSS-CHECK each
 *      callback so a forged callback cannot grant on its own.
 * ════════════════════════════════════════════════════════════════════ */

const API_BASE = process.env.RISKPAY_API_BASE ?? "https://api.riskpay.biz";
const PAY_BASE = process.env.RISKPAY_PAY_BASE ?? "https://pay.riskpay.biz";

/** Maximum allowed drift between the expected order amount and the
 *  USDC value the provider actually sent (fees/rate slippage). */
const AMOUNT_TOLERANCE = 0.10;

const FETCH_TIMEOUT_MS = 15_000;

export type TemporaryWallet = {
  /** Encrypted payment identifier — required by the payment URL. */
  addressIn: string;
  /** Plaintext receiving address — must match the callback's address_in. */
  polygonAddressIn: string;
  /** Token for the payment-status endpoint (cross-check). */
  ipnToken: string;
};

/**
 * The merchant USDC (Polygon) payout wallet. RiskPay has no accounts —
 * this address IS the merchant identity. Fails closed when unset.
 */
export function getMerchantWallet(): string {
  const wallet = process.env.RISKPAY_MERCHANT_WALLET;
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    throw new Error("RISKPAY_MERCHANT_WALLET is not set or not a valid Polygon address");
  }
  return wallet;
}

export function isRiskPayConfigured(): boolean {
  const wallet = process.env.RISKPAY_MERCHANT_WALLET;
  return !!wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet);
}

/**
 * Step 1 — create the temporary per-order wallet.
 *
 * The callback URL must carry at least one UNIQUE parameter value per
 * call (same value ⇒ same temporary wallet) — we pass the order ref
 * plus a random per-order secret, so every order gets its own wallet
 * and its callback URL is unguessable.
 */
export async function createTemporaryWallet(params: {
  orderRef: string;
  callbackSecret: string;
  siteUrl: string;
}): Promise<TemporaryWallet> {
  const callback = encodeURIComponent(
    `${params.siteUrl}/api/riskpay/callback?ref=${params.orderRef}&t=${params.callbackSecret}`
  );
  const url =
    `${API_BASE}/control/wallet.php?address=${getMerchantWallet()}&callback=${callback}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`RiskPay wallet creation failed: ${res.status}`);
  }
  const data = (await res.json()) as Record<string, string>;

  if (!data.address_in || !data.polygon_address_in || !data.ipn_token) {
    throw new Error("RiskPay wallet response missing required fields");
  }
  return {
    addressIn: data.address_in,
    polygonAddressIn: data.polygon_address_in,
    ipnToken: data.ipn_token,
  };
}

/**
 * Step 2 — the customer-facing checkout URL (multi-provider gateway:
 * the customer picks card / PayPal / bank / crypto on-ramp on
 * RiskPay's hosted page). Must be a full-page redirect, never an
 * iframe (provider requirement).
 */
export function buildPaymentUrl(params: {
  addressIn: string;
  customerEmail: string;
  amountUsd: number;
}): string {
  const q = new URLSearchParams({
    address: params.addressIn,
    email: params.customerEmail,
    amount: params.amountUsd.toFixed(2),
    currency: "USD",
  });
  return `${PAY_BASE}/payment-creating.php?${q.toString()}`;
}

export type RiskPayPaymentStatus = {
  status: "paid" | "unpaid" | string;
  value_coin?: string;
  txid_out?: string;
  coin?: string;
};

/**
 * Payment status lookup via the ipn_token. Casual/cross-check use
 * only — the callback is the primary notification channel (per docs,
 * this endpoint is rate-limited).
 */
export async function getPaymentStatus(
  ipnToken: string
): Promise<RiskPayPaymentStatus> {
  const url = `${API_BASE}/control/payment-status.php?ipn_token=${encodeURIComponent(ipnToken)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`RiskPay status check failed: ${res.status}`);
  }
  return (await res.json()) as RiskPayPaymentStatus;
}

/**
 * Amount sanity check — did the provider actually send (roughly) the
 * order amount in USDC? Generous tolerance for fees/rate drift.
 */
export function isAmountAcceptable(
  expectedUsd: number,
  valueCoin: number
): boolean {
  if (!Number.isFinite(expectedUsd) || expectedUsd <= 0) return false;
  if (!Number.isFinite(valueCoin)) return false;
  return valueCoin >= expectedUsd * (1 - AMOUNT_TOLERANCE);
}
