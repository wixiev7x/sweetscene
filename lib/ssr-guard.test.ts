/** Guards against site-wide client-side-render bailout. Run: npm test
 *
 * AuthModalProvider wraps every page (app/layout.tsx). If it calls
 * useSearchParams() itself, Next.js bails the whole subtree out of static
 * prerender: every page ships an empty <main> (no h1/body text for crawlers).
 * useSearchParams must live only in the AuthQueryOpener leaf.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../components/auth/AuthModal.tsx", import.meta.url), "utf8");

function body(fn: string) {
  const start = src.indexOf(`function ${fn}(`);
  assert.notEqual(start, -1, `${fn} not found`);
  const next = src.indexOf("\nfunction ", start + 1);
  const nextExport = src.indexOf("\nexport function ", start + 1);
  const ends = [next, nextExport].filter((i) => i > start);
  return src.slice(start, ends.length ? Math.min(...ends) : undefined);
}

test("AuthModalProvider does not call useSearchParams directly", () => {
  assert.doesNotMatch(body("AuthModalProvider"), /useSearchParams\(/);
});

test("AuthQueryOpener reads search params and is Suspense-wrapped", () => {
  assert.match(body("AuthQueryOpener"), /useSearchParams\(/);
  assert.match(body("AuthModalProvider"), /<Suspense[^>]*>\s*<AuthQueryOpener/);
});
