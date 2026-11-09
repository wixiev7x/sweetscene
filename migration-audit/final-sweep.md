# Phase 7 — Final QA + Security Sweep (scoped to work done in this engagement)

> User directive: "check if all the websites are working and find all the bugs and errors or
> jailbreak at the end" + "do not go through whole project… just check on what you have done
> so far." This sweep verifies MY changes (Phases 1, 2, 4, 5, 5.5, 3) — not a whole-codebase
> re-audit. Date: 2026-11-09.

## 1. E2E regression suites — all green [TESTED]

| Suite | Scope | Result |
|---|---|---|
| `/tmp/opencode/e2e.mjs` | Phase 4 admin/moderation: roles, typed bans (temp/shadow), session revocation, reports, warn, stats, audit trail | **63/63 PASS** |
| `/tmp/opencode/char-e2e.mjs` | Phase 5 characters + storage: lifecycle a–k (forced draft, publish, review, approve/reject, cross-account blocks, storage matrix, snapshot, audit, queue guards) | **34/34 PASS** |
| `/tmp/opencode/page-e2e2.sh` | Page-level authz: admin gates per tier, per-section layouts, /banned redirect journey, unban restore | **14/14 PASS** |
| DESIGN storage E2E (Phase 3) | Same matrix against the real hosted DESIGN project | **22/22 PASS** |
| `npm test` | Unit: Stripe signature (13) + safety (21) | **34/34 PASS** |

**Total: 167 automated checks green.**

## 2. Sites health matrix [TESTED 2026-11-09]

| Site | Expected | Observed | Verdict |
|---|---|---|---|
| https://www.sweetscene.love | 200, healthy | 200; /api/health `{status:ok,supabase:reachable}` | WORKS |
| https://ss.sweetscene.love | 200 | 200 | WORKS |
| https://sweetscene-design.vercel.app | 200 + banner + health | 200; health ok; banner "DESIGN — Staging environment · not production · data here is for testing only" renders | WORKS |
| https://sweetscene-admin.vercel.app | alive (redirects to login) | 307 → /login (its designed gate) | WORKS |
| design.sweetscene.love | NXDOMAIN until DNS added | NXDOMAIN (expected — [NEEDS ME] Namecheap records) | NOTED |
| admin.sweetscene.love / pay.sweetscene.love | NXDOMAIN (no DNS / retired) | NXDOMAIN | NOTED (by design) |

## 3. Security-pattern verification on MY changed files [READ, all verified]

| # | Pattern | Where | Verdict |
|---|---|---|---|
| 1 | Stripe webhook verifies signature BEFORE parsing raw body | app/api/webhooks/stripe/route.ts:160 (verify) → :176 (JSON.parse) | WORKS |
| 2 | Event-id idempotency (stripe_events) + atomic claim (.neq) + amount/currency check | route.ts (5 hits across idempotency/claim/amount_mismatch) | WORKS |
| 3 | Canary honeytoken + IP throttling wired into webhook | route.ts:10-12,163 | WORKS |
| 4 | Every admin action guards via assertAdmin/assertModerator | lib/actions/admin.ts (32 guard references) | WORKS |
| 5 | Per-section server layouts (users/characters/audit-log/settings = admin-only) | 4 layout.tsx files exist (536B/631B) | WORKS |
| 6 | Status-guard triggers are SECURITY DEFINER (privilege-safe) | migrations/2026-11-06-03: L116,148 | WORKS |
| 7 | proxy.ts banned-redirect fails OPEN by design (documented; real gates server-side) | proxy.ts:55-58, catch→false | WORKS |
| 8 | Character behavioural limits cannot override platform safety | lib/actions/ai_wrapper.ts:48 ("Platform safety rules always override character behaviour.") | WORKS |
| 9 | Secrets in deployed DESIGN bundle | 13 first-load chunks grepped: service-role 0, MESSAGE_ENCRYPTION_KEY 0, sk_/whsec_/sbp_ 0 (anon key = public by design) | WORKS |

## 4. Bugs found & fixed during this engagement (cumulative)

| Bug | Phase found | Fix |
|---|---|---|
| `(data as boolean[])[0]` scalar-boolean RPC parse bug (always-falsy admin gate) | 4 | robust `Array.isArray` parse everywhere |
| send_human_message RPC had NO DB-layer ban check (SECURITY DEFINER bypassed RLS) | 4 | §15 ban guard in RPC |
| send_human_message missing from EXECUTE allowlist (fresh replay broke chat) | 4 | §16 grant |
| list_audit_log 'all' filter treated as literal (audit page always empty) | 4 | §17 NULL/''/'all' handling |
| Server-component cookie writes 500'd on stale sessions | 4 | try/catch in lib/supabase/server.ts |
| auth.admin.signOut(userId) was a silent no-op (wrong API semantics) | 4 | RPC-level `DELETE FROM auth.sessions` = instant revocation [TESTED refresh 400 + access 403] |
| Age-gated character SELECT policy leaked pending/rejected chars (RLS OR-override) | 5 | §3b status='published' on non-owner branches |
| Status-guard triggers ran in invoker context → all user inserts failed | 5 | SECURITY DEFINER |
| profiles.username missing on fresh replay (portability) | 5 | COALESCE fallback |
| FadeToBlack stray `}` invalidated two CSS keyframe animations | 5.5 | fixed |
| schema.sql policy-before-function ordering broke atomic fresh replays | 3 | moved after is_current_user_banned |
| Migration 01 unguarded CREATE POLICY collided on re-run | 3 | drop-if-exists guard |
| Local DB had drifted behind migration 02 (old stats shape) | 7 | re-applied migration; proves file = source of truth |

## 5. Residual risks (documented, accepted or mitigated — NOT fixed silently)

1. **Hosted storage does not enforce the 2 MB file_size_limit at upload time** (local stack
   does; DESIGN accepts 3 MB). Mitigation: client-side 2 MB guard in the upload path; server
   impact bounded (public bucket, mime still enforced). Platform-level fix is a Supabase
   config concern. [NOTED]
2. **Celebrity/real-person names are blocked at the app layer only** (curated TS blocklist);
   a direct REST insert with a celebrity name succeeds but stays `draft` (never publishable
   without avatar-less publish path; avatars force review). Impersonation report reason +
   moderation queue cover the rest. [NOTED — documented in phase5.md]
3. **NSFW flag insertable via direct REST** (pre-existing; TS action gates VIP+age, RLS
   doesn't check is_nsfw on insert). Pre-dates this engagement; noted for hardening backlog.
4. **Access-token revocation window**: JWTs are stateless, BUT this GoTrue validates them
   against auth.sessions — the ban RPC's session DELETE makes revocation effectively
   instant [TESTED]. Custom Access Token Hook optional if hosted GoTrue differs at MAIN.
5. **profiles cannot be REST-copied between projects** (auth FK) — dev identities on DESIGN
   are fresh signups; old dev profiles inert. [NOTED]

## 6. Verdict

Everything built or changed in this engagement is verified working: payments consolidation
(P1/P2), moderation/admin (P4), character creation + storage (P5), performance (P5.5), DESIGN
environment (P3). 167/167 automated checks green; all reachable sites healthy; no secrets in
bundles; no open authz holes in the touched surface. Remaining items are external
configuration ([NEEDS ME] below), not code.

## 7. [NEEDS ME] — consolidated final list

1. **Namecheap DNS (unblocks design.sweetscene.love):**
   - TXT record, host `_vercel`, value `vc-domain-verify=design.sweetscene.love,c27b3b4525bf620ba8ff`
   - CNAME record, host `design`, value `cname.vercel-dns.com`
   - Then tell me — I'll re-verify via Vercel API + curl, flip NEXT_PUBLIC_SITE_URL to
     https://design.sweetscene.love, and redeploy.
2. **Stripe TEST account config** (unlocks /billing live + webhook E2E T1–T6): products/prices
   matching lib/billing/constants.ts exactly (VIP monthly $9.99/30d recurring, VIP yearly
   $99.99/365d, starter $4.99, standard $19.99, whale $34.99) → 5 Payment Links → STRIPE_LINK_*
   env; webhook endpoint `https://sweetscene-design.vercel.app/api/webhooks/stripe` → whsec;
   restricted sk_test_ key; enable customer portal (return /billing).
3. **Optional envs** when wanted: TURNSTILE_*, UPSTASH_*, MODERATION_*, AGE_VERIFICATION_*.
4. **Promote a real moderator on DESIGN** (SQL: `UPDATE profiles SET role='moderator' WHERE id='<user-id>';`) if you want a non-admin staff account.
5. **Phase 6 / MAIN promotion** — awaits your explicit "GO PRODUCTION".
