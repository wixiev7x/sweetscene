# chatty — Master To-Do

> Anonymous AI roleplay dating platform. Two humans match anonymously,
> enter a shared scene with 1–3 AI characters (the "third wheel /
> director"), roleplay until a token pool depletes, then a "Fade to
> Black" dual-consent reveal decides whether they unlock DMs or part
> ways. 13+. SFW + NSFW modes (NSFW adult-opt-in only).

**Stack:** Next.js 16.2.9 (NOT 15 — `proxy.ts` not `middleware.ts`),
React 19, Tailwind v4, Supabase (Postgres + Realtime + RLS + OAuth),
DeepSeek API (pluggable, mock fallback), Pollinations/Gemini images,
Upstash Redis (optional, in-memory fallback), Cloudflare Turnstile.

**Root:** `/home/void/chatty`

---

## Global rules (every AI session must follow)

1. Read `/home/void/chatty/AGENTS.md` first — this is NOT the Next.js
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
8. Verify after every phase: `cd /home/void/chatty && npx tsc --noEmit
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
| 7 | ⏳ Pending | DMs hardening |
| 8 | ⏳ Pending | Stripe monetization |
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
- [x] `git init` in `/home/void/chatty`, `.gitignore`, commit baseline.

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
3. Phase 8 — Stripe (1 day)
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