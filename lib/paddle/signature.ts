import { createHmac, timingSafeEqual } from "node:crypto";

/* ════════════════════════════════════════════════════════════════════
 * Paddle Billing webhook signature verification.
 *
 * Paddle signs each delivery with HMAC-SHA256 over `${ts}:${rawBody}`,
 * keyed by the notification destination's secret key, and sends:
 *
 *   Paddle-Signature: ts=1671552777;h1=eb4d0dc8…[;h1=…]
 *
 * Multiple h1 entries can appear while a secret is being rotated — any
 * matching entry accepts. Pure module (no "server-only") so it is
 * unit-testable: lib/paddle/signature.test.ts.
 * ════════════════════════════════════════════════════════════════════ */

/** Replay window. Paddle's sample uses 5s; retries re-sign with a fresh
 *  ts, so a wider window only absorbs clock skew. */
export const PADDLE_DEFAULT_TOLERANCE_SECONDS = 300;

export type PaddleSignatureFailure =
  | "missing_header"
  | "missing_timestamp"
  | "malformed_timestamp"
  | "missing_signature"
  | "stale_timestamp"
  | "signature_mismatch";

export type PaddleSignatureCheck =
  | { ok: true; timestamp: number }
  | { ok: false; reason: PaddleSignatureFailure };

export function verifyPaddleSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds: number = PADDLE_DEFAULT_TOLERANCE_SECONDS,
): PaddleSignatureCheck {
  if (!header) return { ok: false, reason: "missing_header" };

  let tsRaw: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "ts" && tsRaw === null) tsRaw = value;
    else if (key === "h1" && value) signatures.push(value);
  }

  if (tsRaw === null) return { ok: false, reason: "missing_timestamp" };
  if (!/^\d+$/.test(tsRaw)) return { ok: false, reason: "malformed_timestamp" };
  if (signatures.length === 0) return { ok: false, reason: "missing_signature" };

  const ts = Number(tsRaw);
  if (Math.abs(nowSeconds - ts) > toleranceSeconds) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${tsRaw}:${rawBody}`, "utf8").digest("hex"),
    "utf8",
  );
  for (const sig of signatures) {
    const given = Buffer.from(sig.toLowerCase(), "utf8");
    if (given.length === expected.length && timingSafeEqual(given, expected)) {
      return { ok: true, timestamp: ts };
    }
  }
  return { ok: false, reason: "signature_mismatch" };
}
