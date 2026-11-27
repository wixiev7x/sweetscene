/** Protected-route matcher. Run: npm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isProtectedPath } from "./routes.ts";

test("gated prefixes and their subpaths are protected", () => {
  for (const p of ["/characters", "/characters/my", "/chat/abc", "/admin", "/admin/users", "/profile"]) {
    assert.equal(isProtectedPath(p), true, p);
  }
});

test("public pages and look-alike paths are not protected", () => {
  for (const p of ["/", "/explore", "/create", "/chatroom", "/characterseo", "/admin/login", "/blog/x"]) {
    assert.equal(isProtectedPath(p), false, p);
  }
});
