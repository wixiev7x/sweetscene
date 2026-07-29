# sweetscene — Master To-Do

> Anonymous AI roleplay dating platform. Two humans match anonymously,
> enter a shared scene with 1–3 AI characters (the "third wheel /
> director"), roleplay until a token pool depletes, then a "Fade to
> Black" dual-consent reveal decides whether they unlock DMs or part
> ways. 13+. SFW + NSFW modes (NSFW adult-opt-in only).

**Stack:** Next.js 16.2.9 (NOT 15 — `proxy.ts` not `middleware.ts`),
React 19, Tailwind v4, Supabase (Postgres + Realtime + RLS + OAuth),
DeepSeek API (pluggable, mock fallback), Pollinations/Gemini images,
Upstash Redis (optional, in-memory fallback), Cloudflare Turnstile.

**Root:** `/home/void/sweetscene`

---

## Global rules (every AI session must follow)

1. Read `/home/void/sweetscene/AGENTS.md` first — this is NOT the Next.js
   you know. `proxy.ts` exports `proxy()`, not `middleware()`. Read
   `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
   before writing proxy code.
2. NEVER use `NEXT_PUBLIC_` for secrets. Server-only via
   `import "server-only"` in every action file.
3. Every server action starts with `"use server";` then
   `import "server-only";`.
4. Update Supabase by RPC (SECURITY DEFINER) for any multi-step
   mutation (claim match, reveal, refund, token deduction, AI turn).
   App-level conditional UPDATEs race and leak auth.
5. Strict RLS on every table. Column-level REVOKE on sensitive columns
   (`system_prompt`, `tokens_balance`, `is_vip`, `shared_pool`).
6. Every human message passes through two filters before persisting or
   hitting the AI: `sanitizeMessage` (URLs/emails/phones → [REDACTED])
   AND `scrubInjection` (prompt-injection patterns → [REDACTED]).
   `containsBlockedTerm` hard-refuses CSAM/violence/doxxing.
7. One file per change. Match existing code style (doc comments on
   every function — preserve that style).
8. Verify after every phase: `cd /home/void/sweetscene && npx tsc --noEmit
   && npx eslint && rm -rf .next && npx next build`. All three must
   exit 0.
9. All chats cloud-based via Supabase, login-gated, encrypted at rest
   (AES-256-GCM, `MESSAGE_ENCRYPTION_KEY`).
10. Nothing important hardcoded — all URLs/keys/flags come from env
    vars with safe dev defaults.

---

## Phase status

| Phase | Status | Summary |
|-------|--------|---------|
| 0 | ✅ Done | Security hardening (scrubInjection, wrapper, RLS, auth re-verify, blocked terms) |
| 1 | ✅ Done | Pluggable AI provider + mock fallback |
| 2 | ✅ Done | Character creation parity (Janitor/SpicyChat), card import/export |
| 3 | ✅ Done | Solo play persistence + history + ratings |
| 4 | ✅ Done | Play-while-waiting + AFK kick + anonymous partner view |
| 4.5 | ✅ Done | Message encryption, reports, system_prompt column lockdown |
| 5 | ✅ Done | Security audit fixes (all C/H/M issues) + AI director tuning + hardening |
| 6 | ✅ Done | Vibe Check + reputation + smart refund |
| 7 | ✅ Done | DMs hardening + user blocks + report panel |
| 8A | ✅ Done | Character system rebuild (Character.AI-style fields, per-message tokens, paywall UI) |
| 8 | ⏳ Pending | NOWPayments monetization (replaces Stripe) |
| 9 | ⏳ Pending | Safety/legal final pass |
| 10 | ⏳ Pending | Polish (mechanics) |

---

## PHASE 5 — detailed to-do (current phase)

### Critical discovery from re-audit
The Phase 5 SQL block already in `schema.sql` (lines 551–711) does
`REVOKE SELECT (tokens_balance, is_vip) ON profiles FROM authenticated`
and `REVOKE UPDATE` on all matches columns except `last_activity`. But
the application code was NEVER migrated to use the new RPCs
(`deduct_tokens`, `append_human_message`, `claim_ai_turn`,
`update_profile_username`). Result: **once that SQL runs, the app
breaks in matchmaking, chat, and all profile reads.** This is why
Phase 5 must land as one atomic unit.

### Pre-flight: new broken reads (REVOKED columns)
Every `select("*")` or `select("is_vip"/"tokens_balance")` on
`profiles` breaks post-REVOKE. Confirmed broken call sites:
- `app/profile/page.tsx:91-95` — `select("*")`
- `app/lobby/page.tsx:186-190` & `406-411` — `select("*")`
- `app/chat/[id]/page.tsx:137-141` — `select("*")`
- `app/create-character/page.tsx:89-94` — `select("is_vip")`
- `lib/actions/images.ts:26-34` — `select("is_vip")`
- `lib/actions/matchmaking.ts:76-81, 168-172` — `select("tokens_balance")`

Fix: add `get_own_profile()` SECURITY DEFINER RPC returning the
owner's full row; migrate all reads to a `getMyProfile()` action.

---

### 5a — App/RPC reconciliation (close C1–C6, H1, H2, H5–H7, M1–M9, S17, M3, A1–A5)

#### Item 1 — git init + baseline commit ✅
- [x] `git init` in `/home/void/sweetscene`, `.gitignore`, commit baseline.

#### Item 2 — `lib/supabase/schema.sql` — add missing RPCs
- [ ] `get_own_profile()` → returns caller's full profiles row.
- [ ] `apply_ai_turn(p_match_id, p_character_id, p_encrypted_ai_text, p_tokens_used, p_new_pool, p_end_match)` → inserts AI message + updates matches atomically.
- [ ] `send_human_message(p_match_id, p_encrypted_content)` → atomic: verify participant + status='active' + ai_turn_due=false, INSERT, increment counter, flip ai_turn_due. Returns {messageId, human_message_count, ai_turn_due}.
- [ ] `report_conversation(p_match_id, p_reason, p_evidence)` → verify participant before insert; cap evidence to last 100 messages.
- [ ] `consume_solo_tokens(p_session_id, p_amount)` → atomic decrement of solo_sessions.tokens_used only if owner.
- [ ] `request_ai_nudge(p_match_id)` → flips ai_turn_due=true ONLY if participant + active + ai_turn_due=false + now()-last_human_message_at > 15s.
- [ ] `request_direct_turn(p_match_id)` → flips ai_turn_due=true if participant + active + ai_turn_due=false (for @character direct-address trigger).
- [ ] `touch_match_activity(p_match_id)` → minimal last_activity=now() for participants (add only if heartbeat whole-row UPDATE is rejected).
- [ ] `add_tokens(p_user_id, p_amount)` → refund helper (called from matchmaking on failed match insert after deduct).
- [ ] `unclaim_match(p_match_id)` → resets user_b to NULL (for failed token deduction after claim).
- [ ] Column REVOKE: `solo_sessions.tokens_used` from authenticated (self can't reset).
- [ ] Verify messages INSERT RLS requires `status IN ('active','revealed')`.

#### Item 3 — `lib/actions/matchmaking.ts`
- [ ] Replace `select("tokens_balance")` + absolute `update({tokens_balance})` with `deduct_tokens` RPC.
- [ ] C4 fix: re-check VIP for `deep` tier server-side via `get_own_profile`.
- [ ] M3 fix: validate `tags` against fixed SCENARIO_TAGS allowlist before PostgREST filter.
- [ ] On create: deduct first, then insert; if insert fails, refund via `add_tokens`.
- [ ] On claim: `claim_match` RPC → `deduct_tokens` → if NULL, `unclaim_match`.

#### Item 4 — `lib/actions/ai_wrapper.ts`
- [ ] `claim_ai_turn` RPC first; abort silently if NULL (someone else won the race).
- [ ] `apply_ai_turn` RPC to write pool/status/ai_turn_due (NOT client `matches.update`).
- [ ] A1: `limit(12)` → `limit(20)`.
- [ ] A2: rolling summary — when messages.length === 20, cheap summarization pass, prepend "Story so far: …", cache on `matches.context_summary`, refresh every 10 messages.
- [ ] A6: graceful silent fallback "The character hesitates and falls silent for a moment…" on AI error.
- [ ] S11: sanitize AI output (`scrubInjection(sanitizeMessage(aiText))`) before encrypt+insert.
- [ ] H7 fix in `getSoloPlayResponse`: verify caller can see character (public/unlisted/owner) before admin read.

#### Item 5 — `lib/actions/messages.ts`
- [ ] `sendMessage` → `send_human_message` RPC (after encrypting server-side).
- [ ] `getMatchMessages` → cursor pagination (default 50, max 200). M9 fix.
- [ ] `decryptMessageContent` → M1 fix: verify ciphertext belongs to this match via admin row lookup before decrypting.
- [ ] `reportConversation` → `report_conversation` RPC.

#### Item 6 — `lib/actions/presence.ts`
- [ ] Verify heartbeat `update({last_activity})` survives REVOKE. Add `touch_match_activity` RPC if needed.

#### Item 7 — `lib/actions/solo.ts`
- [ ] H2: server-side token budget check + `consume_solo_tokens` RPC.
- [ ] S17/M8: 30-message cap on `is_waiting` sessions.
- [ ] H7: visibility check before admin read in `resolveCharacter`.
- [ ] M7 (DEFERRED to Phase 9): JSONB read-modify-write race.

#### Item 8 — `app/chat/[id]/page.tsx`
- [ ] Remove client `matches.update` (lines 463–471). Use RPC return for optimistic state.
- [ ] A3: direct-address trigger — if text matches `@<charName>`/`@director`/`@ai`, call `requestDirectAITurn`.
- [ ] A4: silence nudge — `setInterval(15s)` calling `requestAINudge` when idle.
- [ ] Profile read → `getMyProfile` action.

#### Item 9 — `lib/ai/prompts.ts`
- [ ] A5: extend `SECRET_PREFIX` with supporting-character behavior clause.

#### Item 10 — `app/dm/[id]/page.tsx` + `app/profile/page.tsx`
- [ ] DM `handleSend`: add `sanitizeAndScrub` + refuse media/attachment patterns.
- [ ] Profile username save → `update_profile_username` RPC.
- [ ] Profile sign-out → new `signOut` server action.
- [ ] Profile load → `getMyProfile` action.
- [ ] Lobby/chat/create-character profile reads → `getMyProfile`.

#### Item 11 — `lib/actions/profile.ts` (NEW file)
- [ ] `getMyProfile()` — calls `get_own_profile` RPC.
- [ ] `updateMyUsername(name)` — wraps `update_profile_username`.
- [ ] `signOut()` — server action.

#### Item 12 — Commit 5a + To-Do.md update
- [ ] Commit: `phase 5a: app/rpc reconciliation`.

---

### 5b — Hardcoded values, rate-limit, auth, headers (S1–S13)

#### Item 13 — `lib/ai/deepseek.ts`
- [ ] Endpoint from `DEEPSEEK_ENDPOINT` env.
- [ ] Key from `AI_API_KEY` only; remove legacy `DEEPSEEK_API_KEY` fallback. S13.
- [ ] 30s `AbortController` timeout. S7.

#### Item 14 — `lib/actions/images.ts`
- [ ] Gemini URL from `GEMINI_ENDPOINT` env. S2b.
- [ ] Unsplash fallback from `UNSPLASH_FALLBACK_IMAGE` env.
- [ ] VIP read via `get_own_profile` RPC.

#### Item 15 — `components/TurnstileWidget.tsx` + `lib/actions/ai_wrapper.ts`
- [ ] Script URL from `NEXT_PUBLIC_TURNSTILE_SCRIPT_URL`. S2c.
- [ ] Verify URL from `TURNSTILE_VERIFY_URL`. S2d.
- [ ] S6: fail-closed in production when Turnstile secret unset.

#### Item 16 — `lib/utils/crypto.ts`
- [ ] S1: fail-fast in production when `MESSAGE_ENCRYPTION_KEY` missing.

#### Item 17 — `lib/actions/auth.ts` + `lib/actions/profile.ts`
- [ ] S4: IP-based brute-force throttle on `signInWithProvider`.
- [ ] S5: new `signOut()` server action.

#### Item 18 — `lib/utils/ratelimit.ts`
- [ ] S3: `getClientIp()` from `CF-Connecting-IP`/`X-Forwarded-For`.
- [ ] `rateLimitByIp(ip, max, window)`.
- [ ] S10: bound the in-memory map (evict oldest 50% at 100k entries).

#### Item 19 — `app/auth/callback/route.ts`
- [ ] S8/H3: validate `next` to same-origin paths only.

#### Item 20 — `proxy.ts`
- [ ] S9: security headers (CSP, HSTS in prod, Referrer-Policy, X-Content-Type-Options, Permissions-Policy).
- [ ] Verify matcher excludes `api`, `auth/callback`, `_next/*`.

#### Item 21 — `lib/utils/logger.ts` (NEW file)
- [ ] S12: structured logger (`info/warn/error`). Sentry hook interface (no SDK install yet).

#### Item 22 — `.env.local` additions
- [ ] Add: `DEEPSEEK_ENDPOINT`, `GEMINI_ENDPOINT`, `TURNSTILE_VERIFY_URL`, `NEXT_PUBLIC_TURNSTILE_SCRIPT_URL`, `UNSPLASH_FALLBACK_IMAGE`, `SENTRY_DSN` (empty defaults).

#### Item 23 — Verification gate
- [ ] `npx tsc --noEmit` exit 0.
- [ ] `npx eslint` exit 0.
- [ ] `rm -rf .next && npx next build` exit 0.
- [ ] Mental test: client `profiles.update({is_vip:true})` and `matches.update({shared_pool:999999})` both reject.

#### Item 24 — Commit 5b + To-Do.md final
- [ ] Commit: `phase 5b: hardening (S1–S13)`.

---

### DEFERRED to Phase 9
- M7: solo JSONB read-modify-write race (wrap in RPC later).
- S19: Realtime RLS enforcement verification (needs Supabase dashboard).
- S20: report snapshot cap (partially handled — 100-msg cap in RPC).
- S21: admin-client auth-guard wrapper.
- S22: Realtime subscription rate-limit.
- S23: crypto `server-only` import guard note (already guarded).

---

## NOT Phase 5 (noted for later phases)
- `match_characters_snapshot` table exists but no code populates it — editing a character mid-match changes the AI. Phase 6+ writes snapshot rows.
- `match_partners` view exposes raw partner UUID pre-reveal (L13) + `getRevealState` returns partner UUID (L18) — Phase 6/7.
- `unlisted` characters unreadable by non-creators (L14) — Phase 6.
- Tier/pool constants + scenario tag lists duplicated across 4 files (L15/L16) — Phase 10.

---

## Build order after Phase 5
1. Phase 6 — Vibe Check + reputation + smart refund (1.5 days)
2. Phase 7 — DMs hardening (0.5 day)
3. Phase 8 — NOWPayments (replaces Stripe) (1 day)
4. Phase 9 — Safety/legal + deferred S19–S23 (0.5 day)
5. Phase 10 — Polish mechanics + Lovable handoff (1.5 days)

---

## ✅ Phase 5 — COMPLETED (what was actually done)

**Verification:** `tsc --noEmit` ✅ `eslint` ✅ `next build` ✅ — all exit 0.

### Files changed (one per change)

1. **`lib/supabase/schema.sql`** — Added 9 new SECURITY DEFINER RPCs:
   - `get_own_profile()` — returns caller's full profile row (B1–B6 fix).
   - `send_human_message(p_match_id, p_encrypted_content)` — atomic INSERT + counter + ai_turn_due (C1/H1/M2/M6).
   - `apply_ai_turn(p_match_id, p_encrypted_text, p_character_id, p_tokens_used, p_new_pool, p_end_match)` — atomic AI message insert + match update (C5/H6).
   - `request_direct_turn(p_match_id)` — @character addressing trigger (A3).
   - `request_ai_nudge(p_match_id)` — silence nudge after 15s idle, server-gated (A4).
   - `report_conversation(p_match_id, p_reason, p_evidence)` — participant-verified report filing (M5).
   - `update_solo_session(p_session_id, p_messages, p_tokens_used)` — atomic solo write after column REVOKE.
   - `add_tokens(p_user_id, p_amount)` — refund helper for failed match creation.
   - `unclaim_match(p_match_id)` — resets user_b on failed post-claim token deduction.
   - Column REVOKE on `solo_sessions.tokens_used` + `messages` columns (L17).
   - Tightened messages INSERT RLS (idempotent DROP+recreate, status IN ('active','revealed')).

2. **`lib/actions/matchmaking.ts`** — deduct_tokens RPC for atomic token deduction (H5 TOCTOU), get_own_profile for balance read (B6), server-side VIP re-check for deep tier (C4), tag allowlist validation (M3), refund on failed insert, unclaim on failed deduction.

3. **`lib/actions/ai_wrapper.ts`** — claim_ai_turn + apply_ai_turn RPCs (C5/H6), limit 12→20 (A1), rolling summary cached on context_summary every 10 messages (A2), graceful "The character hesitates…" fallback (A6), AI output sanitization before encrypt (S11), H7 visibility check in getSoloPlayResponse, Turnstile URLs from env (S2d), fail-closed in prod (S6), added requestDirectAITurn + requestAINudge exports (A3/A4).

4. **`lib/actions/messages.ts`** — send_human_message RPC (C1/H1/M2/M6), cursor pagination on getMatchMessages (M9), decryption-oracle fix — verify ciphertext belongs to match via admin row lookup (M1), reportConversation via report_conversation RPC (M5), rate-limit on sendMessage (H8) and decryptMessageContent (H9).

5. **`lib/actions/solo.ts`** — update_solo_session RPC for writes (column REVOKE), 30-message cap on waiting-room sessions (S17/M8), is_waiting column read for cap check.

6. **`lib/actions/characters.ts`** — C3: server-side VIP re-check for NSFW character creation via admin client.

7. **`lib/actions/images.ts`** — VIP via get_own_profile RPC (B5), Gemini endpoint from env (S2b), Unsplash fallback from env (S2b).

8. **`lib/actions/profile.ts`** (NEW) — getMyProfile, updateMyUsername, signOut server actions (B1–B4, S5).

9. **`lib/actions/auth.ts`** — S4: IP-based brute-force throttle (5 attempts/5 min) via rateLimitByIp + getClientIp.

10. **`lib/ai/prompts.ts`** — A5: supporting-character behavior constraint clause added to SECRET_PREFIX.

11. **`lib/ai/deepseek.ts`** — S2a: endpoint from env, S7: 30s AbortController timeout, S13: legacy DEEPSEEK_API_KEY removed.

12. **`lib/utils/crypto.ts`** — S1: fail-fast in production when MESSAGE_ENCRYPTION_KEY missing.

13. **`lib/utils/ratelimit.ts`** — S3: getClientIp (CF-Connecting-IP/X-Forwarded-For) + rateLimitByIp, S10: bounded in-memory map (evicts at 100k).

14. **`lib/utils/logger.ts`** (NEW) — S12: structured logger with Sentry hook interface.

15. **`components/TurnstileWidget.tsx`** — S2c: script URL from env.

16. **`app/auth/callback/route.ts`** — S8/H3: `next` param validated to same-origin paths only.

17. **`proxy.ts`** — S9: security headers (CSP, HSTS, Referrer-Policy, X-Content-Type-Options, Permissions-Policy, X-Frame-Options).

18. **`app/chat/[id]/page.tsx`** — Removed client matches.update (C1/M2), use RPC return for optimistic state, A3 direct-address trigger, A4 silence-nudge interval, profile read via getMyProfile (B3).

19. **`app/dm/[id]/page.tsx`** — Added sanitizeAndScrub to DM handleSend (DM filter hole closed).

20. **`app/profile/page.tsx`** — getMyProfile (B1), updateMyUsername RPC, signOut server action (S5).

21. **`app/lobby/page.tsx`** — getMyProfile for profile reads (B2).

22. **`app/create-character/page.tsx`** — getMyProfile for VIP read (B4).

### Issues closed

- **Critical:** C1, C2, C3, C4, C5, C6 (all 6) ✅
- **High:** H1, H2, H5, H6, H7, H8, H9 + H3 (open redirect) (all 9) ✅
- **Medium:** M1, M2, M3, M5, M6, M8, M9 (7 of 9) ✅ — M7 (solo JSONB race) DEFERRED to Phase 9, S20 (report cap) partially handled (100-msg cap).
- **Broken reads:** B1, B2, B3, B4, B5, B6 (all 6) ✅
- **Low:** L1 (crypto fail-fast), L2 (6 hardcoded URLs from env), L3 (IP rate limit), L4 (brute-force), L5 (server signOut), L6 (Turnstile fail-closed), L7 (fetch timeout), L8 (security headers), L9 (bounded map), L10 (AI output sanitized), L11 (logger), L12 (legacy key removed) (12 of 18) ✅
- **AI director:** A1 (limit 20), A2 (rolling summary), A3 (direct-address), A4 (silence nudge), A5 (behavior clause), A6 (graceful fallback) (all 6) ✅

### Deferred to Phase 9 (documented)
- M7: solo JSONB read-modify-write race.
- S19: Realtime RLS enforcement verification.
- S21: admin-client auth-guard wrapper.
- S22: Realtime subscription rate-limit.
- S23: crypto server-only import note.
- L13–L18: partner UUID exposure, unlisted sharing, constant duplication (Phase 6/7/10).

---

## ✅ Phase 5 Re-Audit — COMPLETED

Re-read every file from phases 0–5. Found and fixed 7 bugs:

1. **F1 (Critical):** `apply_ai_turn` RPC accepted `p_new_pool` as a parameter — any authenticated user could call `supabase.rpc("apply_ai_turn", ...)` to set the pool to any value and inject fake AI messages. **Fixed:** pool now computed server-side inside the RPC (reads `shared_pool` with `FOR UPDATE`, subtracts `p_tokens_used`). RPC signature changed — `p_new_pool`/`p_end_match` removed, `p_caller_id` added. RPC is now `service_role`-only (`REVOKE EXECUTE FROM authenticated`). The server action calls it via the admin client.

2. **F2 (Critical):** `add_tokens` RPC accepted any `p_user_id` — any user could call `supabase.rpc("add_tokens", { p_user_id: myId, p_amount: 999999 })` to give themselves unlimited tokens (same class as C2 that Phase 5 was supposed to close). **Fixed:** `REVOKE EXECUTE FROM authenticated/anon` → `service_role`-only. Matchmaking calls via admin client.

3. **F3 (Critical):** `unclaim_match` had no caller verification — any user could kick someone from a match. **Fixed:** accepts `p_caller_id`, verifies `user_b = p_caller_id`. `REVOKE EXECUTE → service_role`-only.

4. **F4 (High):** `appendSoloMessage` in `solo.ts` didn't sanitize AI output before storing (S11 was only half-applied — `getSoloPlayResponse` sanitized but `appendSoloMessage` didn't). **Fixed:** now calls `scrubInjection(sanitizeMessage(aiResult.content))`.

5. **F5 (Medium):** `update_solo_session` returned `success=true` even when no row was updated (wrong session_id/wrong user). **Fixed:** uses `GET DIAGNOSTICS ROW_COUNT` to return the actual result.

6. **F6 (Medium):** `report_conversation` had a NULL-reason logic bug (`IF NOT p_reason IS NULL AND ...` should have been `IF p_reason IS NULL OR ...`). Wrong condition would cause a NOT NULL constraint violation instead of a clean return. **Fixed.**

7. **F7 (Low):** `crypto.ts` had a duplicate JSDoc comment block from the S1 edit. **Removed.**

**Verification after re-audit fixes:** `tsc --noEmit` ✅ `eslint` ✅ `next build` ✅ — all exit 0.

---

## ✅ Phase 6 — COMPLETED (Vibe Check + reputation + smart refund)

**Verification:** `tsc --noEmit` ✅ `eslint` ✅ `next build` ✅ — all exit 0.

### Files changed

1. **`lib/supabase/schema.sql`** — Added:
   - `match_ratings` table (vibe/tags/reason/wants_reveal, unique per match+rater, RLS: insert+select own only).
   - `reputation_events` table (append-only audit trail, no RLS for authenticated → service_role-only).
   - `profiles` new columns: `reputation_tier`, `recent_ratings`, `earned_tags`, `connection_tickets` (all REVOKE'd from authenticated UPDATE).
   - `submit_match_rating` RPC — verifies participant + ended/revealed, inserts rating, calls recompute_tier + resolve_refund when both ratings exist.
   - `recompute_tier` RPC — aggregates last 10 ratings (electric=+2, warm=+1, neutral=0, cold=-2), sets tier (new/regular/trusted/legendary), derives earned_tags from tag frequency every 5 ratings. Internal-only (REVOKE EXECUTE from authenticated).
   - `resolve_refund` RPC — smart refund rules (mutual_end=no refund, partner_afk=50% refund to wronged party, mismatch=flag for review). Logs to reputation_events. Internal-only.
   - `end_match` RPC — ends active match + inserts preliminary rating. Service_role-only.
   - `get_own_profile` updated to return the new columns.

2. **`lib/actions/ratings.ts`** (NEW) — `submitMatchRating` (wraps submit_match_rating RPC, validates vibe/reason/tags), `getMyReputation` (returns tier + earned_tags via get_own_profile).

3. **`lib/actions/match.ts`** (NEW) — `unmatch` action (ends match mid-scene via end_match RPC, service_role-only).

4. **`lib/actions/profile.ts`** — `MyProfile` type updated with `reputation_tier`, `earned_tags`, `connection_tickets`, `recent_ratings`.

5. **`components/FadeToBlack.tsx`** — Vibe Check second screen: after the reveal/move-on outcome is shown, a "Rate this scene" button transitions to the rating form (4 emoji vibes: 🔥/😊/😐/🥶, optional one-word tags up to 3, reason dropdown). Submitting calls `submitMatchRating`, then "Continue" routes via `onVibeCheckComplete`.

6. **`app/chat/[id]/page.tsx`** — Removed auto-route to `/dm` (Vibe Check now handles routing). Added `handleVibeCheckComplete` (routes to `/dm` if both revealed, else `/lobby`). Passed `onVibeCheckComplete` to FadeToBlack. Removed unused `revealRoutingRef`.

---

## ✅ Phase 7 — COMPLETED (DMs hardening + user blocks)

**Verification:** `tsc --noEmit` ✅ `eslint` ✅ `next build` ✅ — all exit 0.

### Pre-audit (phases 0–6) — 3 bugs found and fixed

1. **B1 (Phase 4 bug):** `FadeToBlack` showed a "Reveal Myself" button for AI matches — but AI matches have no human partner to reveal back, so the user would click Reveal and get stuck in the "waiting for them…" state forever. **Fixed:** `FadeToBlack` now accepts an `isAiMatch` prop; the Reveal button is hidden for AI matches; the Move On button becomes "Continue" with the subtitle "Rate the scene and leave". The chat page passes `match.is_ai_match`.

2. **B2 (Phase 6 bug):** `resolve_refund` included `'boring'` in the `partner_afk` confirmation list. A partner saying "boring" didn't confirm they went AFK — that's a mismatch and should be flagged for review. **Fixed:** only `'i_left'` and `'instant_disconnect'` count as the partner confirming they disconnected.

3. **B3 (Phase 6 dead code):** `resolve_refund` declared `wronged_id` but never used it. **Removed.** Also added an explicit AI-match bail (`user_b IS NULL → RETURN`) so the function returns early instead of running a no-row SELECT on `r_b` then falling through.

### Files changed in Phase 7

1. **`lib/supabase/schema.sql`** — Added:
   - `user_blocks` table (blocker_id, blocked_id, unique index, RLS: owner can view/insert/delete their own blocks only). Silent block — the blocked user is not notified.
   - `claim_match` RPC updated to refuse matching two users where either has blocked the other.
   - `connection_tickets` UPDATE REVOKE from authenticated reaffirmed (Phase 8 will write to it via service_role).

2. **`lib/actions/blocks.ts`** (NEW) — `blockUser` (idempotent upsert), `unblockUser` (delete), `listMyBlocks` (join to profiles for anonymous display info).

3. **`lib/actions/messages.ts`** — New `sendDMMessage` action: verifies `match.status='revealed'` server-side (closes H4 — the previous DM access guard was client-only and bypassable), refuses media/attachment patterns (image/video/audio file extensions, base64 data URIs, image-host URLs) so DMs stay text-only per spec. Delegates to `sendMessage` for the full sanitize+scrub+block+RPC pipeline.

4. **`app/dm/[id]/page.tsx`** — Switched from `sendMessage` to `sendDMMessage`. Added a Report panel (textarea + submit button) wired to `reportConversation` — closes the safety loop on DMs. User can report a conversation for moderation; the last 100 messages are decrypted and snapshotted via the `report_conversation` RPC.

5. **`components/FadeToBlack.tsx`** — Added `isAiMatch` prop (B1 fix); hide Reveal button for AI matches.

6. **`app/chat/[id]/page.tsx`** — Pass `match.is_ai_match` to FadeToBlack.

---

## ✅ Phase 8A — COMPLETED (Character system rebuild)

**Verification:** `tsc --noEmit` ✅ `eslint` ✅ `next build` ✅ — all exit 0, zero warnings.

### What changed

This phase rebuilt the character system to match Character.AI / Janitor-style fields and added per-message token accounting for solo play.

### Files changed

1. **`lib/ai/mock.ts`** — Removed all hardcoded archetype lines (maid, nurse, barista, librarian, yoga, chef, detective, trainer) and the roleplay-flavored default pool. Mock now returns a single neutral line that works in any character chat without faking a persona.

2. **`lib/supabase/schema.sql`** — Added:
   - `characters` new columns: `short_description`, `backstory`, `full_personality`, `tags TEXT[]`, `category TEXT` (companion/roleplay/adventure/romance/assistant/other), `chat_count INT`.
   - Indexes on `category` and `chat_count DESC`.
   - `chat_count` UPDATE REVOKE from authenticated (server-managed only via `increment_chat_count` RPC).
   - `token_transactions` table (per-user ledger: delta, reason, match_id, payment_id, RLS: owner SELECT only).
   - `increment_chat_count` RPC (service_role-only).
   - `record_token_transaction` RPC (service_role-only internal ledger writer).
   - `deduct_message_tokens` RPC (service_role-only, atomic decrement + ledger entry).

3. **`lib/ai/prompts.ts`** — Added `buildCharacterChatPrompt()` for solo character chat. Unlike the matched-scene `buildSystemPrompt` (which frames the AI as an "actress in an uncensored novel"), this builder produces a Character.AI-style prompt from the new fields (name, full_personality, short_description, backstory). Includes anti-injection clause.

4. **`lib/actions/characters.ts`** — Extended `CreateCharacterParams` with `short_description`, `full_personality`, `backstory`, `tags`, `category`. Added validation (MAX_SHORT_DESC=200, MAX_FULL_PERSONALITY=3000, MAX_BACKSTORY=3000, MAX_NEW_TAGS=10, VALID_CATEGORIES). Extended SELECT columns and filters in `getPublicCharacters` (category filter, personality search includes new fields).

5. **`lib/actions/avatars.ts`** — Avatar generation now accepts a free-form user-written prompt (e.g. "red haired anime girl, green eyes, shy smile") with the SFW guard prepended. Added typed `uploadToStorage()` stub for future Supabase Storage integration (Phase 10).

6. **`lib/actions/solo.ts`** — Per-message token deduction via `deduct_message_tokens` RPC (service_role-only, atomic). `increment_chat_count` RPC called on new session creation. `buildCharacterChatPrompt` used instead of `buildSystemPrompt` for solo character play. AI output sanitized before storing.

7. **`app/create-character/page.tsx`** — Form extended with: short description, full personality (textarea), backstory (textarea), tags (comma-separated), category (dropdown). Avatar prompt is now free-form text. Reset function clears all new fields.

8. **`app/characters/page.tsx`** — Browse page: category filter chips, short_description display on cards (falls back to user_prompt), chat_count displayed (replaces connection_score on card face), new tags shown, popular sort now uses chat_count. Search includes short_description.

9. **`app/play/[id]/page.tsx`** — Paywall UI: when `appendSoloMessage` returns a token-related error, a full-screen paywall modal appears with "You're out of tokens / Top up coming soon" and a "Back to Characters" link. Also fires when client-side TOKEN_BUDGET check triggers.

---

## FULL PROJECT AUDIT — What's left, what can be added

**Status:** Phases 0–7 + 8A complete (8 of 14 phases). ~12,000+ LOC. 50+ files. 13 routes. Schema: 1,607 lines, 12 tables, 15+ RPCs. All tsc + eslint + next build pass clean.

### What EXISTS and is functional (don't rebuild)
- ✅ OAuth auth (Google + Discord) via Supabase, with Turnstile captcha + IP brute-force throttle
- ✅ Matchmaking: findMatch, createAIMatch, claim_match RPC, play-while-waiting, AFK kick (pg_cron 90s)
- ✅ Matched chat: encrypted messages (AES-256-GCM), realtime, AI director (3 triggers: every-6, direct-address, silence-nudge), rolling story summary
- ✅ Solo play: persistent sessions, per-message token deduction, greeting opener, regenerate, rating, character chat prompts
- ✅ Character system: Character.AI-style fields (short_description, full_personality, backstory, tags, category), AI avatars, card import/export
- ✅ Fade to Black: dual-consent reveal via RPC, Vibe Check rating (4 emojis + tags + reason), reputation tiers (new/regular/trusted/legendary), earned tags, smart refunds
- ✅ DMs: text-only (media blocked), server-side status=revealed check, report panel
- ✅ User blocks: silent block, matchmaking exclusion
- ✅ Security: column-level REVOKE, service_role-only RPCs, prompt-injection defense (3 layers), PII scrubbing, blocked terms, brute-force throttle, security headers, open-redirect fix, bounded rate-limit map, structured logger
- ✅ Token economy: token_transactions ledger, deduct_tokens/deduct_message_tokens atomic RPCs

### What EXISTS but is incomplete / has bugs
- ⚠️ `match_characters_snapshot` table exists but is NEVER POPULATED — editing a character mid-match changes the AI for in-flight scenes
- ⚠️ `uploadToStorage` in avatars.ts is a stub — no Supabase Storage integration
- ⚠️ `TOKEN_BUDGET = 5000` in play page is client-only — server enforces per-message deduction but not the total session cap
- ⚠️ `handleBuyVIP` in profile page is a placeholder — no payment wired
- ⚠️ `logger.ts` Sentry hook is a no-op — no telemetry actually emits
- ⚠️ `credit_tokens` RPC doesn't exist — `record_token_transaction` comments mention it for Phase 8
- ⚠️ `getRevealState` returns raw partner UUID pre-reveal (L18, L13)
- ⚠️ `unlisted` characters unreadable by non-creators (L14)
- ⚠️ M7 deferred: solo JSONB read-modify-write race (two tabs, last write wins)
- ⚠️ S21 open: server-admin.ts has no code-level auth guard wrapper
- ⚠️ S22 deferred: no Realtime subscription rate-limit
- ⚠️ L15/L16: tier/pool constants + scenario tag lists duplicated across 4+ files (no shared lib/config/constants.ts)

### What is MISSING entirely (needs new phases)
- ❌ NO payment integration (Phase 8 — NOWPayments)
- ❌ NO legal pages: ToS, Privacy, DMCA, age verification (Phase 9)
- ❌ NO admin dashboard / moderation UI (Phase 10)
- ❌ NO notifications system (Phase 11)
- ❌ NO tests — zero test files, zero test deps (Phase 12)
- ❌ NO full-text search — ilike only, no relevance ranking, no fuzzy matching
- ❌ NO PWA setup — no manifest, no service worker
- ❌ NO email system — no transactional emails (welcome, ban, DM notification)
- ❌ NO analytics/telemetry — logger is console-only, Sentry is a stub
- ❌ NO design-system components — every page hand-rolls Tailwind
- ❌ NO migration versioning — single 1,607-line schema.sql applied manually

---

## REMAINING PHASES — Detailed plan (6 phases)

### Phase 8 — NOWPayments monetization (1 day)
**Goal:** Real VIP checkout + token purchases via NOWPayments (crypto).

- 8.1 `lib/nowpayments/server.ts` (NEW) — NOWPayments API client (server-only). Reads `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_API_BASE` from env.
- 8.2 `lib/actions/billing.ts` (NEW) — `createVIPOrder()` → NOWPayments invoice (subscription), `createTokenOrder(quantity)` → one-time payment. Both auth-checked.
- 8.3 `app/api/nowpayments/webhook/route.ts` (NEW) — IPN webhook handler. Verifies signature, handles `payment_confirmed` → grant VIP / credit tokens. Idempotent on payment ID.
- 8.4 Schema — `credit_tokens` RPC (service_role-only). `nowpayments_events` idempotency table. `payments` table (order_id, user_id, status, amount, crypto_amount, currency, created_at).
- 8.5 `app/profile/page.tsx` — wire "Become VIP" to `createVIPOrder` → redirect to NOWPayments URL.
- 8.6 `app/play/[id]/page.tsx` — paywall modal "Top Up" button → `createTokenOrder` → redirect.
- 8.7 Free-tier daily match cap: findMatch + createAIMatch count today's matches; if !is_vip AND count >= 3, refuse.
- 8.8 .env.local — add `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_API_BASE`.
- 8.9 Verify: tsc + eslint + next build.

### Phase 9 — Safety & legal final pass (0.5 day)
**Goal:** Launchable on safety grounds.

- 9.1 `app/legal/terms/page.tsx` — real ToS copy (13+, NSFW opt-in, automated moderation, law-enforcement, no-media-in-DMs, refund policy). Get lawyer to review.
- 9.2 `app/legal/privacy/page.tsx` — real Privacy Policy.
- 9.3 `app/login/page.tsx` — required ToS checkbox before OAuth. Store `profiles.tos_accepted_at`.
- 9.4 Birthday picker (13+ floor) replacing the 18+ yes/no gate in `app/page.tsx`. `profiles.age_cohort` column.
- 9.5 NSFW opt-in popup — `setNsfwOptIn(true)` server action, RPC re-validates `age_cohort='adult'`. `profiles.nsfw_opt_in` column.
- 9.6 "Leave scene" button in chat header — calls `unmatch(matchId, 'instant_disconnect')` with confirmation popup ("tokens will be deducted and rating will be down").
- 9.7 Fix deferred: M7 (solo JSONB race via RPC), S21 (admin-client auth guard), S22 (realtime subscription rate-limit equivalent).
- 9.8 Fix L13/L18: hash partner UUID in match_partners view + getRevealState.
- 9.9 Fix L14: unlisted characters readable by non-creators who know the UUID.
- 9.10 Verify: tsc + eslint + next build.

### Phase 10 — Admin dashboard + moderation (0.5 day)
**Goal:** Human tooling for the data infrastructure that already exists.

- 10.1 `app/admin/page.tsx` — admin dashboard (gated by `profiles.is_admin` flag, new column).
- 10.2 `lib/actions/admin.ts` (NEW) — `listReports`, `resolveReport`, `banUser`, `unbanUser`, `grantTokens`, `featureCharacter`, `unfeatureCharacter`. All service_role.
- 10.3 `app/admin/reports/page.tsx` — report queue UI (reads reports table via admin client, shows decrypted evidence).
- 10.4 `app/admin/users/page.tsx` — user search, ban/suspend, token grant/refund.
- 10.5 `app/admin/characters/page.tsx` — feature/unfeature, hide, force-delete.
- 10.6 Fix M7: populate `match_characters_snapshot` at match creation.
- 10.7 Verify.

### Phase 11 — Notifications + email (0.5 day)
**Goal:** Offline engagement loop.

- 11.1 Schema — `notifications` table (user_id, type, title, body, read_at, match_id, created_at). RLS: owner SELECT/UPDATE read_at.
- 11.2 `lib/actions/notifications.ts` (NEW) — `getNotifications`, `markAsRead`, `createNotification` (internal). Called on match-found, reveal, new DM, rating received.
- 11.3 `components/NotificationBell.tsx` — bell icon with unread count, dropdown list.
- 11.4 Realtime notification channel — subscribe to `notifications` inserts.
- 11.5 Optional: email integration (Resend/Postmark) for critical notifications. Defer if budget tight.
- 11.6 Verify.

### Phase 12 — Polish + PWA + Lovable handoff (1.5 days)
**Goal:** Production-ready, installable, semantic for Lovable AI restyle.

- 12.1 `lib/config/constants.ts` (NEW) — extract tier/pool constants + scenario tags (fix L15/L16).
- 12.2 `components/` — extract reusable: `Navbar`, `Avatar`, `CharacterCard`, `TokenMeter`, `Modal`, `Button`, `Input`, `LoadingSpinner`, `EmptyState`, `Skeleton`.
- 12.3 Framer Motion — install, wrap FadeToBlack entrance, Vibe Check modal, match-found toast.
- 12.4 shadcn/ui adoption — `npx shadcn@latest init`, swap primitives.
- 12.5 PWA — `app/manifest.ts`, `app/sw.ts` service worker, viewport meta in layout.
- 12.6 Mobile responsive audit — fix horizontal overflow on chat/lobby.
- 12.7 Full-text search — `pg_trgm` extension, GIN index on `characters.name` + `short_description`, fuzzy search.
- 12.8 Wire `logger.ts` Sentry hook — install `@sentry/node`, set `SENTRY_DSN`.
- 12.9 Wire `uploadToStorage` — Supabase Storage bucket for user-uploaded avatars.
- 12.10 Semantic audit — `<div onClick>` → `<button>`, `aria-label` on icon buttons, `<label htmlFor>` on all inputs, real `<form onSubmit>` on create-character.
- 12.11 `LOVABLE.md` — handoff doc explaining what's wired vs UI-only.
- 12.12 Verify.

### Phase 13 — Testing (0.5 day)
**Goal:** Security-critical RPCs have test coverage.

- 13.1 Install vitest + @testing-library/react.
- 13.2 Unit tests for `crypto.ts` (encrypt/decrypt roundtrip, tamper detection).
- 13.3 Unit tests for `safety.ts` (scrubInjection, containsBlockedTerm, sanitizeMessage).
- 13.4 Unit tests for `ratelimit.ts` (in-memory limit, eviction).
- 13.5 Integration tests for matchmaking RPCs (deduct_tokens, claim_match, send_human_message).
- 13.6 E2E test: signup → create character → solo play → matchmaking → chat → reveal → DM.
- 13.7 Verify.

---

## Build order (updated)

1. ~~Phase 0–7 + 8A~~ ✅ DONE
2. Phase 8 — NOWPayments (1 day)
3. Phase 9 — Safety/legal (0.5 day)
4. Phase 10 — Admin + moderation (0.5 day)
5. Phase 11 — Notifications + email (0.5 day)
6. Phase 12 — Polish + PWA + Lovable handoff (1.5 days)
7. Phase 13 — Testing (0.5 day)

**Total remaining: ~4.5 days. End-state LOC estimate: ~15–18k.**