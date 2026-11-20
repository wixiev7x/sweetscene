/**
 * Unit tests for Paddle webhook signature verification. Run: npm test
 * HMACs computed locally — no network, no Paddle account needed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyPaddleSignature } from "./signature.ts";

const SECRET = "pdl_ntfset_test_secret_value";
const BODY = '{"event_id":"evt_1","event_type":"transaction.completed","data":{}}';
const NOW = 1_800_000_000;

function sign(ts: number | string, body = BODY, secret = SECRET): string {
  return createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
}

test("valid signature accepted", () => {
  const r = verifyPaddleSignature(BODY, `ts=${NOW};h1=${sign(NOW)}`, SECRET, NOW);
  assert.deepEqual(r, { ok: true, timestamp: NOW });
});

test("tampered body rejected", () => {
  const r = verifyPaddleSignature(BODY + " ", `ts=${NOW};h1=${sign(NOW)}`, SECRET, NOW);
  assert.deepEqual(r, { ok: false, reason: "signature_mismatch" });
});

test("wrong secret rejected", () => {
  const r = verifyPaddleSignature(BODY, `ts=${NOW};h1=${sign(NOW, BODY, "other")}`, SECRET, NOW);
  assert.deepEqual(r, { ok: false, reason: "signature_mismatch" });
});

test("missing header / ts / h1", () => {
  assert.deepEqual(verifyPaddleSignature(BODY, null, SECRET, NOW), { ok: false, reason: "missing_header" });
  assert.deepEqual(verifyPaddleSignature(BODY, `h1=${sign(NOW)}`, SECRET, NOW), { ok: false, reason: "missing_timestamp" });
  assert.deepEqual(verifyPaddleSignature(BODY, `ts=${NOW}`, SECRET, NOW), { ok: false, reason: "missing_signature" });
  assert.deepEqual(verifyPaddleSignature(BODY, `ts=abc;h1=${sign("abc")}`, SECRET, NOW), { ok: false, reason: "malformed_timestamp" });
});

test("stale and future timestamps rejected", () => {
  const old = NOW - 301;
  assert.deepEqual(verifyPaddleSignature(BODY, `ts=${old};h1=${sign(old)}`, SECRET, NOW), { ok: false, reason: "stale_timestamp" });
  const fut = NOW + 301;
  assert.deepEqual(verifyPaddleSignature(BODY, `ts=${fut};h1=${sign(fut)}`, SECRET, NOW), { ok: false, reason: "stale_timestamp" });
});

test("rotation: any matching h1 accepted", () => {
  const h = `ts=${NOW};h1=${sign(NOW, BODY, "old")};h1=${sign(NOW)}`;
  assert.equal(verifyPaddleSignature(BODY, h, SECRET, NOW).ok, true);
});

test("non-hex / short h1 never throws", () => {
  assert.deepEqual(verifyPaddleSignature(BODY, `ts=${NOW};h1=zz`, SECRET, NOW), { ok: false, reason: "signature_mismatch" });
});
