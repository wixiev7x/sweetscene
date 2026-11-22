/** Hover-card validator + inline parser. Run: npm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeHoverCard, parseInline, isSafeUrl } from "./schema.ts";

test("rejects non-object and oversized cards", () => {
  assert.ok("error" in sanitizeHoverCard(null));
  assert.ok("error" in sanitizeHoverCard({ blocks: Array(21).fill({ type: "divider" }) }));
  assert.ok("error" in sanitizeHoverCard({ blocks: Array(10).fill({ type: "text", text: "x".repeat(500) }) }));
});

test("drops unknown block types and unsafe links", () => {
  const r = sanitizeHoverCard({
    blocks: [
      { type: "script", text: "<script>alert(1)</script>" },
      { type: "link", label: "bad", url: "javascript:alert(1)" },
      { type: "link", label: "http", url: "http://example.com" },
      { type: "link", label: "ok", url: "https://example.com/x" },
      { type: "image", url: "https://evil.com/a.png" },
    ],
  });
  assert.ok("card" in r);
  if ("card" in r) {
    assert.equal(r.card.blocks.length, 1);
    assert.deepEqual(r.card.blocks[0], { type: "link", label: "ok", url: "https://example.com/x" });
  }
});

test("theme falls back to defaults on bad values", () => {
  const r = sanitizeHoverCard({ blocks: [], theme: { accent: "red; background:url(x)", bg: "hack", font: "x", border: "y" } });
  assert.ok("card" in r);
  if ("card" in r) assert.deepEqual(r.card.theme, { accent: "#FF2E6A", bg: "glass", font: "round", border: "glow" });
});

test("heading color must be hex", () => {
  const r = sanitizeHoverCard({ blocks: [{ type: "heading", text: "Hi", size: "lg", color: "expression(1)" }] });
  assert.ok("card" in r && !("color" in r.card.blocks[0]));
});

test("inline parser produces plain spans, never HTML", () => {
  const spans = parseInline("**bold** *it* {#ff2e6a}red{/} <b>x</b>");
  assert.deepEqual(spans[0], { text: "bold", b: true });
  assert.deepEqual(spans[2], { text: "it", i: true });
  assert.deepEqual(spans[4], { text: "red", color: "#ff2e6a" });
  assert.equal(spans[spans.length - 1].text, " <b>x</b>");
  assert.ok(!spans.some((s) => "html" in s));
});

test("parser ignores non-hex color tags", () => {
  const spans = parseInline("{red}x{/}");
  assert.equal(spans.map((s) => s.text).join(""), "{red}x");
});

test("isSafeUrl", () => {
  assert.ok(isSafeUrl("https://x.com/a"));
  assert.ok(!isSafeUrl("javascript:alert(1)"));
  assert.ok(!isSafeUrl("https://user:pw@x.com"));
  assert.ok(!isSafeUrl("data:text/html,hi"));
});
