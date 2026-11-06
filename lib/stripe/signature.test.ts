/**
 * Unit tests for Stripe webhook signature verification.
 *
 * Run: npm test
 *
 * The HMAC values are computed locally with node:crypto — no network,
 * no Stripe account needed. These tests pin the exact contract the
 * webhook route depends on:
 *
 *   1. a correctly signed header + raw body  → ok
 *   2. tampered body (1 byte)                → signature_mismatch
 *   3. tampered signature                    → signature_mismatch
 *   4. missing header                        → missing_header
 *   5. missing / malformed timestamp         → missing_timestamp / malformed
 *   6. missing v1                            → missing_signature
 *   7. stale timestamp (> tolerance)         → stale_timestamp
 *   8. future timestamp (> tolerance)        → stale_timestamp
 *   9. multiple v1 entries — any matching CURRENT secret ok;
 *      old-secret v1 (wrong key) rejected
 *  10. first-'=' split + hex truncation: trailing '=' junk ok,
 *      leading junk rejected
 *  11. valid sig but wrong secret            → signature_mismatch
 *  12. non-hex v1 value                      → signature_mismatch (never throws)
 *  13. tolerance boundary is inclusive       → ok
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyStripeSignature,
  STRIPE_DEFAULT_TOLERANCE_SECONDS,
} from "./signature.ts";

const SECRET = "whsec_test_signing_secret_000000000";
const BODY = JSON.stringify({
  id: "evt_test_123",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_123", amount_total: 499 } },
});

const NOW = 1_790_000_000; /* fixed clock — deterministic tests */

function sign(
  body: string,
  secret: string,
  timestamp: number,
): string {
  const v1 = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

const okHeader = sign(BODY, SECRET, NOW);

test("1 · valid signature over the exact raw body is accepted", () => {
  const result = verifyStripeSignature(BODY, okHeader, SECRET, { now: NOW });
  assert.deepEqual(result, { ok: true, timestamp: NOW });
});

test("2 · one flipped byte in the body rejects the signature", () => {
  const tampered = BODY.replace("499", "490");
  assert.notEqual(tampered, BODY);
  const result = verifyStripeSignature(
    tampered,
    okHeader,
    SECRET,
    { now: NOW },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "signature_mismatch");
});

test("3 · tampered v1 value rejects", () => {
  const header = okHeader.slice(0, -2) + "ff";
  const result = verifyStripeSignature(BODY, header, SECRET, { now: NOW });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "signature_mismatch");
});

test("4 · missing header rejects", () => {
  const result = verifyStripeSignature(BODY, null, SECRET, { now: NOW });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "missing_header");
});

test("5 · missing or malformed timestamp rejects", () => {
  const noT = `v1=${createHmac("sha256", SECRET).update(`${NOW}.${BODY}`).digest("hex")}`;
  const result = verifyStripeSignature(BODY, noT, SECRET, { now: NOW });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "missing_timestamp");

  const badT = `t=not-a-number,v1=${createHmac("sha256", SECRET).update(`not-a-number.${BODY}`).digest("hex")}`;
  const result2 = verifyStripeSignature(BODY, badT, SECRET, { now: NOW });
  assert.equal(result2.ok, false);
  if (!result2.ok) assert.equal(result2.reason, "malformed_timestamp");
});

test("6 · missing v1 rejects", () => {
  const result = verifyStripeSignature(BODY, `t=${NOW}`, SECRET, { now: NOW });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "missing_signature");
});

test("7 · timestamp outside tolerance (past) rejects", () => {
  const old = NOW - STRIPE_DEFAULT_TOLERANCE_SECONDS - 1;
  const header = sign(BODY, SECRET, old);
  const result = verifyStripeSignature(BODY, header, SECRET, { now: NOW });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "stale_timestamp");
});

test("8 · timestamp outside tolerance (future) rejects", () => {
  const future = NOW + STRIPE_DEFAULT_TOLERANCE_SECONDS + 1;
  const header = sign(BODY, SECRET, future);
  const result = verifyStripeSignature(BODY, header, SECRET, { now: NOW });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "stale_timestamp");
});

test("9 · multiple v1 entries — any one matching the CURRENT secret accepts", () => {
  const v1Valid = `v1=${createHmac("sha256", SECRET).update(`${NOW}.${BODY}`).digest("hex")}`;
  /* first entry garbage, second valid — must accept (any-match). */
  const header = `t=${NOW},v1=${"0".repeat(64)},${v1Valid}`;
  const result = verifyStripeSignature(BODY, header, SECRET, { now: NOW });
  assert.deepEqual(result, { ok: true, timestamp: NOW });

  /* Rotation reality check: a v1 computed under a DIFFERENT secret
     does NOT verify against the current secret — wrong key can never
     forge. (During rotation Stripe sends both generations and the
     endpoint verifies with whichever secret it currently holds.) */
  const oldSecret = "whsec_rotated_previous_secret_00000";
  const v1Old = `v1=${createHmac("sha256", oldSecret).update(`${NOW}.${BODY}`).digest("hex")}`;
  const headerOld = `t=${NOW},${v1Old}`;
  const resultOld = verifyStripeSignature(BODY, headerOld, SECRET, { now: NOW });
  assert.equal(resultOld.ok, false);
  if (!resultOld.ok) assert.equal(resultOld.reason, "signature_mismatch");
});

test("10 · v1 parsing splits on first '='; hex decode truncates trailing junk", () => {
  const v1 = createHmac("sha256", SECRET).update(`${NOW}.${BODY}`).digest("hex");
  /* Trailing '=' padding: value string differs, but Node's hex
     decoder truncates at the non-hex char, leaving the correct MAC
     bytes — accepted. (Not forgeable: the MAC must still be valid.) */
  const headerPadded = `t=${NOW},v1=${v1}=`;
  const resultPadded = verifyStripeSignature(BODY, headerPadded, SECRET, { now: NOW });
  assert.deepEqual(resultPadded, { ok: true, timestamp: NOW });

  /* LEADING non-hex junk decodes to a shorter/different buffer —
     rejected. */
  const headerJunk = `t=${NOW},v1=zz${v1}`;
  const resultJunk = verifyStripeSignature(BODY, headerJunk, SECRET, { now: NOW });
  assert.equal(resultJunk.ok, false);
  if (!resultJunk.ok) assert.equal(resultJunk.reason, "signature_mismatch");
});

test("11 · valid HMAC under the WRONG secret rejects", () => {
  const header = sign(BODY, "whsec_attacker_different_secret", NOW);
  const result = verifyStripeSignature(BODY, header, SECRET, { now: NOW });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "signature_mismatch");
});

test("12 · non-hex v1 value rejects without throwing", () => {
  const header = `t=${NOW},v1=zzzz-not-hex-at-all`;
  const result = verifyStripeSignature(BODY, header, SECRET, { now: NOW });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "signature_mismatch");
});

test("13 · exactly at the tolerance boundary is accepted", () => {
  const edge = NOW - STRIPE_DEFAULT_TOLERANCE_SECONDS;
  const header = sign(BODY, SECRET, edge);
  const result = verifyStripeSignature(BODY, header, SECRET, { now: NOW });
  assert.deepEqual(result, { ok: true, timestamp: edge });
});
