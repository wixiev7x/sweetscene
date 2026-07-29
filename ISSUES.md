# sweetscene — Security Issue Inventory

> Complete audit findings from the deep code review conducted before
> Phase 5. **Read this before editing any security-sensitive code.**
> Every issue below maps to the Phase 5 to-do in `To-Do.md`.
>
> Severity legend:
> - **C** = Critical (exploitable right now, pre-RLS lockdown)
> - **H** = High (serious but harder to exploit)
> - **M** = Medium (race / leak / edge case)
> - **L** = Low (hardcoded values, minor leaks, architecture notes)
> - **B** = Broken (the Phase 5 SQL block already applied but the app
>   code wasn't migrated — the SQL itself *creates* new breakage)

**Total: 6 Critical + 9 High + 9 Medium + 18 Low + 6 Broken-read = 48 issues.**

---

## 🔴 CRITICAL (exploitable right now)

| # | Issue | File(s) | Impact |
|---|-------|---------|--------|
| C1 | Client directly writes `matches` table — `human_message_count`, `ai_turn_due`, `shared_pool`, `status`, reveal flags all client-writable | `app/chat/[id]/page.tsx:463-471` + `schema.sql:146-148` (no WITH CHECK, no column REVOKE) | User can force infinite tokens, fake reveals, force-end opponent's match, skip AI turns |
| C2 | Client directly writes `profiles` table — no column restriction on UPDATE | `app/profile/page.tsx:131-135` + `schema.sql:36-38` | User can self-grant VIP (`is_vip=true`), unlimited tokens, max reputation — bypasses the entire paywall |
| C3 | Server doesn't re-check VIP for NSFW character creation | `lib/actions/characters.ts` `createCharacter` | Any user can create NSFW characters by calling the action directly, bypassing the client gate |
| C4 | Server doesn't re-check VIP for Deep Dive tier | `lib/actions/matchmaking.ts` `findMatch`/`createAIMatch` | Any user can get Deep Dive matches (10k tokens) by calling the action directly |
| C5 | `matches` UPDATE RLS has no WITH CHECK or column restrictions | `schema.sql:146-148` | Either participant can UPDATE any column: shared_pool, status, user_b, user_a_revealed, user_b_revealed, all of it |
| C6 | `profiles` UPDATE RLS has no WITH CHECK or column restrictions | `schema.sql:36-38` | User can set `tokens_balance`, `is_vip`, `reputation_score` to anything |

---

## 🟠 HIGH (serious but needs more effort to exploit)

| # | Issue | File(s) | Impact |
|---|-------|---------|--------|
| H1 | `sendMessage` doesn't check match status or `ai_turn_due` | `lib/actions/messages.ts:52-92` | Messages can be sent to ended matches; spam during AI turns |
| H2 | Solo token budget is client-only (5000) | `app/play/[id]/page.tsx:61` + `lib/actions/solo.ts` | Server never checks `tokens_used` — unlimited free AI calls |
| H3 | Open redirect in OAuth callback | `app/auth/callback/route.ts:12,25` | `next` param unvalidated — `?next=//evil.com` |
| H4 | DM access guard is client-only | `app/dm/[id]/page.tsx` + `lib/actions/messages.ts` | Server doesn't verify `status='revealed'` before decrypting messages |
| H5 | Token double-spend (TOCTOU) — read balance, check, write absolute value | `lib/actions/matchmaking.ts:82/110, 168/180` | Two concurrent calls pay once — create/join two matches for the price of one |
| H6 | AI turn double-fire + pool double-spend — `ai_turn_due` not atomically flipped before AI call | `lib/actions/ai_wrapper.ts:41-54` vs `152-165` | Two concurrent calls generate twice, debit pool once |
| H7 | `getSoloPlayResponse` reads private characters via admin client with no access check | `lib/actions/ai_wrapper.ts:198-203` | Any user can use any private character's `system_prompt` for AI calls |
| H8 | No rate limit on `sendMessage` | `lib/actions/messages.ts` | Message flooding — no per-user throttle on the most-called action |
| H9 | No rate limit on `decryptMessageContent` | `lib/actions/messages.ts:149-175` | CPU abuse via repeated decrypt calls |

---

## 🟡 MEDIUM (race / leak / edge case)

| # | Issue | File(s) | Impact |
|---|-------|---------|--------|
| M1 | Decryption oracle — `decryptMessageContent` decrypts client-supplied ciphertext without verifying it belongs to the match | `lib/actions/messages.ts:149-175` | Any participant can decrypt arbitrary ciphertext encrypted with the app key |
| M2 | Lost-update race on match counter — client computes count+1 and writes absolute value | `app/chat/[id]/page.tsx:460-471` | Two simultaneous sends both write N+1 — AI turn fires wrong cadence |
| M3 | PostgREST filter injection — tags array interpolated raw into filter literal | `lib/actions/matchmaking.ts:86` | Malicious tags can break out of the array literal |
| M4 | `profiles` SELECT is `USING(true)` — all columns visible to everyone | `schema.sql:32-34` | Any user can read any other user's `tokens_balance`, `is_vip`, `reputation_score` |
| M5 | `reportConversation` accepts any matchId without participant check | `lib/actions/messages.ts:185-244` | Spam reports against matches you were never in |
| M6 | No `match.status` check in messages INSERT RLS | `schema.sql:301-303` | Messages can be inserted into ended matches (fixed in 4.5/5 SQL — verify) |
| M7 | Solo session message append race — read-modify-write on JSONB | `lib/actions/solo.ts:355-420` | Two tabs both read same messages, last write wins, lost AI turn — **DEFERRED to Phase 9** |
| M8 | Waiting-room sessions have no 30-message cap | `lib/actions/solo.ts` | Free waiting-room chat is uncapped |
| M9 | `getMatchMessages` has no pagination | `lib/actions/messages.ts:99-139` | Huge decrypt loop on long matches — DoS vector |

---

## 🔵 LOW (hardcoded values, minor leaks, architecture)

| # | Issue | File(s) |
|---|-------|---------|
| L1 | Hardcoded crypto fallback key `"dev-only-key-change-in-production"` | `lib/utils/crypto.ts:38` |
| L2 | 6 hardcoded URLs (DeepSeek, Gemini, 2x Turnstile, Unsplash, Google) | 4 files |
| L3 | No IP-based rate limiting (no `CF-Connecting-IP` reading) | `lib/utils/ratelimit.ts` |
| L4 | No brute-force protection on login | `lib/actions/auth.ts` |
| L5 | No server-side `signOut` action (client-only) | `app/profile/page.tsx` |
| L6 | Turnstile silently disabled when secret unset | `lib/actions/ai_wrapper.ts` |
| L7 | No fetch timeout on AI calls | `lib/ai/deepseek.ts` |
| L8 | No security headers in proxy | `proxy.ts` |
| L9 | Unbounded in-memory rate-limit map (memory leak) | `lib/utils/ratelimit.ts` |
| L10 | AI output not sanitized before storing | `lib/actions/ai_wrapper.ts` |
| L11 | No structured logging / Sentry hooks | (no file exists) |
| L12 | Legacy `DEEPSEEK_API_KEY` fallback still present | `lib/ai/deepseek.ts` |
| L13 | `match_partners` view exposes raw partner UUID pre-reveal — Phase 6/7 |
| L14 | `unlisted` characters are unreadable by non-creators (broken sharing) — Phase 6 |
| L15 | Tier/pool constants duplicated between client and server — Phase 10 |
| L16 | Scenario tag lists duplicated across 4 files — Phase 10 |
| L17 | `solo_sessions.tokens_used` can be self-reset (no column REVOKE) | `schema.sql:359-362` |
| L18 | `getRevealState` returns partner's raw UUID — Phase 6/7 |

---

## 🟣 BROKEN-READ (new — Phase 5 SQL applied but app code not migrated)

> These are caused by the Phase 5 SQL block (schema.sql:551–711) doing
> `REVOKE SELECT (tokens_balance, is_vip) ON profiles FROM authenticated`.
> The app code still reads these columns directly via the user client,
> so once the SQL runs the reads return NULL and the app breaks.

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| B1 | `profiles SELECT *` fails for non-owner columns post-REVOKE | `app/profile/page.tsx:91-95` | `getMyProfile` action → `get_own_profile` RPC |
| B2 | `profiles SELECT *` fails in lobby | `app/lobby/page.tsx:186-190, 406-411` | `getMyProfile` action |
| B3 | `profiles SELECT *` fails in chat header | `app/chat/[id]/page.tsx:137-141` | `getMyProfile` action |
| B4 | `profiles SELECT is_vip` fails in create-character VIP gate | `app/create-character/page.tsx:89-94` | `getMyProfile` action |
| B5 | `profiles SELECT is_vip` fails in image gen VIP gate | `lib/actions/images.ts:26-34` | `get_own_profile` RPC (server-side) |
| B6 | `profiles SELECT tokens_balance` fails in matchmaking — AND is a TOCTOU race (H5) | `lib/actions/matchmaking.ts:76-81, 168-172` | `get_own_profile` for read + `deduct_tokens` RPC for atomic deduction |

---

## ❓ DEFERRED architecture concerns (Phase 9)

| # | Issue | File(s) | Status |
|---|-------|---------|--------|
| S19 | Realtime RLS enforcement unverified (third party could subscribe to ALL message inserts) | (Supabase dashboard) | Verify in Phase 9 |
| S20 | `reportConversation` could create oversized snapshots | `lib/actions/messages.ts` | 100-msg cap in RPC (partial fix in 5a) |
| S21 | `server-admin.ts` has no code-level guard — callers must remember to auth-check | `lib/supabase/server-admin.ts` | Add `assertUserAuthed` wrapper in Phase 9 |
| S22 | No rate limiting on Realtime subscriptions | (Supabase-side) | Supabase limits suffice for MVP |
| S23 | `crypto.ts` Node crypto module import | `lib/utils/crypto.ts` | Already guarded by `import "server-only"` |

---

## NOT Phase 5 (noted for later phases)

- **`match_characters_snapshot` unpopulated:** the table exists in schema
  but no application code writes to it. Editing a character mid-match
  currently changes the AI behaviour for in-flight scenes. Phase 6+
  writes snapshot rows at match creation and `ai_wrapper` reads from
  the snapshot instead of live `characters`.
- **L13/L18 partner UUID exposure pre-reveal:** `match_partners` view
  and `getRevealState` both return the raw partner UUID before the
  dual-consent reveal. Privacy pass in Phase 6/7.
- **L14 unlisted sharing broken:** the characters SELECT RLS is
  `is_public=true OR creator_id=auth.uid()` — unlisted characters
  (which have `is_public=false`) are unreadable by non-creators. Fix
  in Phase 6 by switching the SELECT policy to `visibility IN
  ('public','unlisted') OR creator_id=auth.uid()`.
- **L15/L16 constant duplication:** tier pool sizes and scenario tag
  lists are duplicated across 4+ files each. Refactor to a shared
  `lib/config/constants.ts` in Phase 10.

---

## Mapping to Phase 5 to-do

| Severity IDs | Phase 5 sub-phase | Verification |
|--------------|-------------------|--------------|
| C1–C6, H1, H2, H5–H7, M1–M9, S17, M3, A1–A5, B1–B6 | **5a** app/rpc reconciliation | `tsc + eslint + build` clean; client UPDATEs of revoked columns rejected |
| L1–L12 (+ S6 fail-closed), S8/H3, S9 | **5b** hardening | URLs from env; `next` validated; security headers present |
| M7, S19–S23 | **Phase 9 deferred** | Documented in To-Do.md |
| L13–L18 | **Phase 6/7/10** | Documented in To-Do.md |