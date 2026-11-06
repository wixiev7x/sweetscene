import { createHmac, timingSafeEqual } from "node:crypto";

/* ════════════════════════════════════════════════════════════════════
 * Stripe webhook signature verification.
 *
 * Stripe signs every webhook delivery with an HMAC-SHA256 of
 * `${timestamp}.${rawBody}` keyed by the endpoint's signing secret,
 * sent in the `Stripe-Signature` header:
 *
 *     Stripe-Signature: t=1730900000,v1=5257a869e7…,v1=6d5b0c1a…
 *
 * (Multiple v1 entries appear when a secret is rotated — a valid v1
 * from ANY generation accepts the delivery.)
 *
 * This module is PURE — no "server-only", no env reads, no logging —
 * so it is unit-testable (lib/stripe/signature.test.ts) and reusable.
 * The webhook route owns the policy: verify BEFORE parsing the body,
 * reject with 400 on failure.
 * ════════════════════════════════════════════════════════════════════ */

/** Stripe's recommended replay window. */
export const STRIPE_DEFAULT_TOLERANCE_SECONDS = 300;

export type SignatureFailureReason =
  | "missing_header"
  | "missing_timestamp"
  | "missing_signature"
  | "malformed_timestamp"
  | "stale_timestamp"
  | "signature_mismatch";

export type SignatureCheck =
  | { ok: true; timestamp: number }
  | { ok: false; reason: SignatureFailureReason };

type ParsedHeader =
  | { timestamp: number; signatures: string[] }
  | { reason: SignatureFailureReason };

function parseHeader(
  header: string,
  nowSeconds: number,
  toleranceSeconds: number,
): ParsedHeader {
  const timestamp: number[] = [];
  const signatures: string[] = [];

  for (const element of header.split(",")) {
    const idx = element.indexOf("=");
    if (idx === -1) continue;
    /* Only split on the FIRST '=' — a base64 v1 value may itself
       contain '=' padding. */
    const key = element.slice(0, idx).trim();
    const value = element.slice(idx + 1).trim();
    if (key === "t") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return { reason: "malformed_timestamp" };
      timestamp.push(parsed);
    } else if (key === "v1") {
      signatures.push(value);
    }
  }

  if (timestamp.length === 0) return { reason: "missing_timestamp" };
  if (signatures.length === 0) return { reason: "missing_signature" };

  const t = timestamp[0];
  /* Replay/future guard — outside the tolerance window either
     direction means the delivery is not trustworthy. */
  if (Math.abs(nowSeconds - t) > toleranceSeconds) {
    return { reason: "stale_timestamp" };
  }

  return { timestamp: t, signatures };
}

/**
 * Verify a Stripe-Signature header against the exact raw request body.
 *
 * Returns `{ ok: true }` when at least one v1 entry is a valid
 * HMAC-SHA256 of `${t}.${rawBody}` under `secret` and `t` is inside
 * the tolerance window. Constant-time comparison throughout.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  options?: { toleranceSeconds?: number; now?: number },
): SignatureCheck {
  if (!signatureHeader) return { ok: false, reason: "missing_header" };

  const toleranceSeconds =
    options?.toleranceSeconds ?? STRIPE_DEFAULT_TOLERANCE_SECONDS;
  const nowSeconds = options?.now ?? Date.now() / 1000;

  const parsed = parseHeader(signatureHeader, nowSeconds, toleranceSeconds);
  if (!("timestamp" in parsed)) {
    return { ok: false, reason: parsed.reason };
  }

  const expected = createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");

  for (const candidate of parsed.signatures) {
    let candidateBuf: Buffer;
    try {
      candidateBuf = Buffer.from(candidate, "hex");
    } catch {
      continue; /* not hex — cannot be a valid v1 */
    }
    if (candidateBuf.length !== expectedBuf.length) continue;
    if (timingSafeEqual(candidateBuf, expectedBuf)) {
      return { ok: true, timestamp: parsed.timestamp };
    }
  }

  return { ok: false, reason: "signature_mismatch" };
}
