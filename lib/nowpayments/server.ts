import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSetting, SETTING_KEYS } from "@/lib/config/settings";

/* ════════════════════════════════════════════════════════════════════
 * Phase 8 — NOWPayments API client (server-only).
 *
 * Credentials resolve through `lib/config/settings.ts`: the value set
 * in the admin dashboard wins, and the NOWPAYMENTS_API_KEY /
 * NOWPAYMENTS_IPN_SECRET environment variables are the fallback. That
 * lets the operator rotate a leaked key without a redeploy.
 * NOWPAYMENTS_API_BASE stays env-only — it is not a secret and only
 * changes when pointing at a sandbox.
 *
 * API pattern: API key in `x-api-key` header, base URL
 * https://api.nowpayments.io/v1. POST /invoice creates a hosted
 * invoice (returns invoice_url). The IPN webhook sends a signed
 * payload verified via HMAC-SHA512 of the raw body with the IPN
 * secret, compared against the `x-nowpayments-sig` header.
 * ════════════════════════════════════════════════════════════════════ */

/** Timeout for outbound NOWPayments API calls (10 seconds). */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Shape of a NOWPayments /invoice response. The `invoice_url` is where
 * the user is redirected to complete payment. `id` is the order ID we
 * track in the payments table.
 */
export interface NowPaymentsInvoice {
  id: string;
  invoice_url: string;
  order_id: string;
  order_description: string;
  price_amount: number;
  price_currency: string;
  status: string;
}

/**
 * Shape of a NOWPayments payment status response from GET /payment/{id}.
 * Used by the webhook to cross-check the IPN payload against the
 * server-side payment record.
 */
export interface NowPaymentsPaymentStatus {
  payment_status: string;
  order_id: string;
  pay_amount: number;
  actually_paid: number;
  pay_currency: string;
  outcome_currency: string;
}

/**
 * Returns the NOWPayments API base URL from env, falling back to the
 * standard production endpoint.
 */
function getApiBase(): string {
  return process.env.NOWPAYMENTS_API_BASE ?? "https://api.nowpayments.io/v1";
}

/**
 * Returns the NOWPayments API key, preferring the value set in the
 * admin dashboard over the environment. Throws if neither is set — the
 * billing actions and webhook both depend on it.
 */
async function getApiKey(): Promise<string> {
  const key = await getSetting(
    SETTING_KEYS.nowpaymentsApiKey,
    process.env.NOWPAYMENTS_API_KEY
  );
  if (!key) throw new Error("NOWPAYMENTS_API_KEY is not set");
  return key;
}

/**
 * Returns the NOWPayments IPN secret, preferring the value set in the
 * admin dashboard over the environment. Throws if neither is set — the
 * webhook signature verification depends on it.
 */
async function getIpnSecret(): Promise<string> {
  const secret = await getSetting(
    SETTING_KEYS.nowpaymentsIpnSecret,
    process.env.NOWPAYMENTS_IPN_SECRET
  );
  if (!secret) throw new Error("NOWPAYMENTS_IPN_SECRET is not set");
  return secret;
}

/**
 * Creates a NOWPayments hosted invoice via POST /invoice. The user is
 * redirected to the returned `invoice_url` to complete payment.
 *
 * @param params - Invoice details: price, currency, order ID, description.
 * @returns The created invoice with its hosted checkout URL.
 */
export async function createInvoice(params: {
  priceAmount: number;
  priceCurrency: string;
  orderId: string;
  orderDescription: string;
}): Promise<NowPaymentsInvoice> {
  const response = await fetch(`${getApiBase()}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": await getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: params.priceAmount,
      price_currency: params.priceCurrency,
      order_id: params.orderId,
      order_description: params.orderDescription,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`NOWPayments invoice creation failed: ${response.status}`);
  }

  const data = (await response.json()) as NowPaymentsInvoice;

  if (!data.invoice_url || !data.invoice_url.startsWith("https://")) {
    throw new Error("NOWPayments invoice response missing valid invoice_url");
  }

  return data;
}

/**
 * Fetches the payment status for a given payment ID via GET
 * /payment/{id}. Used by the webhook to verify the IPN payload against
 * the server-side record before granting VIP or tokens.
 *
 * @param paymentId - The NOWPayments payment ID.
 * @returns The payment status record.
 */
export async function getPaymentStatus(
  paymentId: string
): Promise<NowPaymentsPaymentStatus> {
  const response = await fetch(`${getApiBase()}/payment/${paymentId}`, {
    headers: { "x-api-key": await getApiKey() },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`NOWPayments status fetch failed: ${response.status}`);
  }

  return (await response.json()) as NowPaymentsPaymentStatus;
}

/** Maximum allowed length of the signature header (4 KB). */
const MAX_SIG_HEADER_LEN = 4096;

/**
 * Compares two hex strings in constant time to prevent timing attacks.
 * Returns false immediately if lengths differ (safe — length is not
 * secret for HMAC digests).
 */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf-8");
  const bb = Buffer.from(b, "utf-8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Splits one `"key": value` segment of a JSON object into its raw key
 * text, parsed key, and raw value text. Returns null if the segment is
 * not a well-formed member.
 */
function splitMember(
  segment: string
): { key: string; rawKey: string; rawValue: string } | null {
  let inString = false;
  let escaped = false;

  for (let i = 0; i < segment.length; i++) {
    const c = segment[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === ":") {
      const rawKey = segment.slice(0, i).trim();
      const rawValue = segment.slice(i + 1).trim();
      if (!rawKey.startsWith('"') || !rawValue) return null;
      try {
        return { key: JSON.parse(rawKey) as string, rawKey, rawValue };
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Re-serialises a flat JSON object with its top-level keys sorted,
 * preserving each value's ORIGINAL raw text.
 *
 * Preserving the raw text matters: NOWPayments signs the output of
 * PHP's `json_encode(json_decode($body))`, and round-tripping numbers
 * through JS (`JSON.parse`/`stringify`) would rewrite `1.50` as `1.5`
 * and break the digest. Byte-preserving the values avoids that whole
 * class of mismatch.
 *
 * Returns null for anything that is not a plain JSON object.
 */
function sortedJsonPreservingRaw(rawBody: string): string | null {
  const s = rawBody.trim();
  if (!s.startsWith("{") || !s.endsWith("}")) return null;

  const inner = s.slice(1, -1);
  if (!inner.trim()) return "{}";

  const members: Array<{ key: string; rawKey: string; rawValue: string }> = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let segStart = 0;

  const pushSegment = (end: number): boolean => {
    const member = splitMember(inner.slice(segStart, end));
    if (!member) return false;
    members.push(member);
    return true;
  };

  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      if (!pushSegment(i)) return null;
      segStart = i + 1;
    }
  }
  if (!pushSegment(inner.length)) return null;

  members.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  return `{${members.map((m) => `${m.rawKey}:${m.rawValue}`).join(",")}}`;
}

/** Recursively sorts object keys, for the JS-normalised candidate. */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) out[k] = sortDeep(src[k]);
    return out;
  }
  return value;
}

/**
 * Every byte sequence NOWPayments might plausibly have signed.
 *
 * Their documented PHP reference implementation is
 * `hash_hmac('sha512', json_encode(ksort(json_decode($body))), $secret)`
 * — the key-SORTED re-encoding, not the raw body. Accepting several
 * candidates is not a security weakening: each is an HMAC under the
 * same secret, so producing any one of them still requires the secret.
 * It only makes verification robust to their serialiser's formatting.
 */
function signingCandidates(rawBody: string): string[] {
  const candidates = new Set<string>();

  /* The documented behaviour, with values kept byte-identical. */
  const sortedRaw = sortedJsonPreservingRaw(rawBody);
  if (sortedRaw) candidates.add(sortedRaw);

  /* Same, but with JS number/string normalisation applied. */
  try {
    candidates.add(JSON.stringify(sortDeep(JSON.parse(rawBody))));
  } catch {
    /* Not valid JSON — the raw candidate below still applies. */
  }

  /* Raw body, for compatibility if they ever sign the payload as sent. */
  candidates.add(rawBody);

  return [...candidates];
}

/**
 * Verifies the NOWPayments IPN webhook signature. The `x-nowpayments-sig`
 * header contains a space-separated list of HMAC-SHA512 digests. If any
 * digest matches any candidate serialisation, the payload is authentic.
 *
 * Uses `crypto.timingSafeEqual` for constant-time comparison to prevent
 * signature forgery via timing side-channels.
 *
 * @param rawBody - The raw request body as a string (utf-8).
 * @param signatureHeader - The value of the `x-nowpayments-sig` header.
 * @returns true if any signature matches, false otherwise.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader || signatureHeader.length > MAX_SIG_HEADER_LEN) {
    return false;
  }

  const secret = await getIpnSecret();

  // NOWPayments may send multiple signatures separated by spaces.
  const signatures = signatureHeader
    .split(" ")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  if (signatures.length === 0) return false;

  const expected = signingCandidates(rawBody).map((candidate) =>
    createHmac("sha512", secret).update(candidate, "utf-8").digest("hex")
  );

  /* No early exit: every candidate is compared against every signature
     so the work done is independent of where a match occurs. */
  let matched = false;
  for (const sig of signatures) {
    for (const digest of expected) {
      if (safeEqual(sig, digest)) matched = true;
    }
  }
  return matched;
}
