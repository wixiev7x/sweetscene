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
| 5 | 🔨 IN PROGRESS | Security re-audit + AI director tuning — THIS IS THE CURRENT PHASE |
| 6 | ⏳ Pending | Vibe Check + reputation + smart refund |
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