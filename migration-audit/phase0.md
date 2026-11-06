# Phase 0 — Inventory (read-only)

Date: 2026-11-06 · Branch examined: `homepage-redesign` (clean; untracked `payment-audit/`) · No changes made to code or infrastructure in this phase.

Evidence labels: `[TESTED]` = command + output observed · `[READ]` = file + lines read · `[ASSUMED]` = inference · UNTESTABLE = cannot verify with current credentials.

---

## 1. Repo map `[READ]`

- `/home/void/sweetscene` — Next.js **16.2.9** App Router, React 19, TypeScript, Tailwind 4, `@supabase/ssr`, Upstash. Scripts: dev/build/start/lint/test.
  - Repo `AGENTS.md`: read `node_modules/next/dist/docs/` before writing code (Next 16 breaking changes).
- Git: origin `github.com/wixiev7x/sweetscene`. Local branches: `main`, `design`, `homepage-redesign` (current), `admin-panel`, `admin-2fa-panel`, `nextjs-backup`. Recent history: RiskPay→PayRam swap (RiskPay fully gone), PayRam webhook amount-trust fix, VIP monthly/yearly renewals, dedicated `/checkout`.
- App pages: achievements, admin(!), age-verification/verify, auth, banned, bounties, characters, chat, checkout, community, complete-profile, confessions, create-character, create, dm, events, explore, forgot-password, how, join, leaderboard, legal, lobby, login, matchmake, play, premium, pricing, profile, quiz, reset-password, safety, scenarios, signup, store, style-guide, terms, trending. **No `/billing` yet.**
- API routes (13): `age-verification/webhook`, `ai/chat`, `cron/subscription-reminders`, `health`, `invite`, `invite/join`, `matchmake/{cancel,friend,join,status,tick}`, `nowpayments/webhook`, `payram/webhook`.
- `vercel.json` crons: `/api/matchmake/tick` 03:00 daily; `/api/cron/subscription-reminders` 14:30 daily.
- **Two admin surfaces** (Phase 4 must choose):
  - (a) main app `app/admin/(auth)/login` + `app/admin/(dashboard)/{audit-log,characters,moderation,reports,settings,users}` — Supabase-auth based, role model `profiles.is_admin BOOLEAN`.
  - (b) `admin/` subproject at repo root — separate Next app ("sweetscene-admin", own package.json, deployed as Vercel project `sweetscene-admin`, working URL `sweetscene-admin.vercel.app`), env: `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `SETTINGS_MASTER_KEY`.
- `DEPLOY.md` describes the OLD serving model (VPS + Cloudflare Tunnel + Supabase Mumbai) — **outdated**; production is on Vercel today (§3).

## 2. Database model `[READ lib/supabase/schema.sql + supabase/migrations/]`

- Auth users: Supabase `auth.users`; app table = **`profiles`** (`id` FK→auth.users, `anonymous_username`, `tokens_balance` default 10000, `is_vip`, `vip_expires_at` (ALTER, col-revoked), `reputation_score`, `is_admin` (line 2209), `is_banned` (2216), `banned_until` (2217), `tos_accepted_at`, `age_cohort`, `nsfw_opt_in`). Signup trigger `handle_new_user`.
- 25 tables incl.: characters, matches, messages, solo_sessions, reports, bans, moderation_queue, admin_audit_log, notifications, platform_settings, token_transactions, **payments**, **nowpayments_events**, bots, matchmaking_queue, invite_links, confessions, bounties.
- Payment-relevant RPCs (SECURITY DEFINER, service-role only): `credit_tokens(p_user_id,p_amount,p_reason,p_payment_id)` (line ~1722), `grant_vip(p_user_id,p_days,p_payment_id)` (~1743, **stacks days onto existing expiry** = `greatest(now, current)+N` semantics), `deduct_message_tokens`, `record_token_transaction`. `get_own_profile` auto-revokes expired VIP (no cron needed for expiry).
- `token_transactions` ledger: reason CHECK includes `purchase|refund|vip_grant|admin`; `payment_id` TEXT.
- Phase 4 relevant (already exists, shapes differ from plan): `bans(user_id, banned_by, reason, banned_at, expires_at, active)` — **no** `type temp/permanent/shadow`, **no** `appeal_state`; `reports(reporter_id, match_id, reason, evidence_snapshot)` — **match-scoped only**, no `target_user_id/content_type/content_id/status`; `admin_audit_log` (append-only, DB-enforced REVOKEs); `moderation_queue`. `profiles` has **no** `role` and **no** `token_version` columns — Phase 4 adds.
- Phase 5 relevant: `characters` exists (creator_id, name, prompts, tags, `visibility private|…`) — plan's `status draft|pending_review|published|rejected`, `triggers[]`, `limits[]`, `tagline` not present. Avatar URLs DB-constrained by `is_safe_avatar_url()` to `https://*.supabase.co/storage/v1/`, `image.pollinations.ai`, `images.unsplash.com` (Supabase Storage OK).
- Stripe today: one COMMENT in schema.sql (~Phase 8 note). No tables, no code.

## 3. Serving topology `[TESTED]`

| Host | DNS | Status |
|---|---|---|
| `sweetscene.love` | A 216.198.79.1 (Vercel) | 308 → www |
| `www.sweetscene.love` | CNAME → Vercel | **200**, `/api/health` = ok/supabase reachable |
| `ss.sweetscene.love` | CNAME → cname.vercel-dns.com | **200** — same MAIN deployment |
| `sweetscene.vercel.app` | — | MAIN project alias |
| `sweetscene-admin.vercel.app` | — | admin subproject (works) |
| `admin.sweetscene.love` | **NXDOMAIN** | Vercel says verified:true, but DNS record absent |
| `design.sweetscene.love` | **NXDOMAIN** | Does not exist yet |
| `pay.sweetscene.love` | **NXDOMAIN** | Nothing public to redirect (Phase 1 redirect step moot) |

- Nameservers: `dns1/dns2.registrar-servers.com` = **Namecheap**, NOT Cloudflare → subdomain DNS records must be added at Namecheap; Cloudflare Access (Phase 4) requires the zone in Cloudflare (user decision).
- Vercel projects `[TESTED API]`: `sweetscene` (prj_sQzOffY5…, GitHub-linked, prod branch `main`, prod deploy READY) + `sweetscene-admin` (prj_sVERXF8z…, same repo). **No DESIGN project exists** (design token sees zero projects; user believed it existed).
- Supabase `[TESTED API]`: management tokens only reach two **paused** projects (`sweetscene` zydwemwlzlrmghlpnqtp Tokyo, `ss design` rcgxcxygoatdmpxnvnbu Sydney). The two **live** projects — `vnugflrlzrvngopweixe` (production, per Vercel env) and `runjhpkyqcdbiijrqmfl` (`sweetscene-staging`, holds dev data, referenced by `.env.local`) — are **not reachable by any token I hold**.
- Local: cloudflared tunnel process running (no public route points to it); Docker `payram` container on 127.0.0.1:8788 (self-hosted gateway, Postgres inside); port 3000 not listening.

## 4. Payment integrations — full inventory

### 4a. NOWPayments (crypto) — RECOMMEND REMOVE (user pre-confirmed) 

- **Code** `[READ]`: `app/api/nowpayments/webhook/route.ts` (454 L), `lib/nowpayments/server.ts` (357 L: `createInvoice`, `getPaymentStatus`, `verifyWebhookSignature` HMAC-SHA512, sandbox detection), `lib/actions/billing.ts` (272 L: `createVipPlanOrder`, `createTokenOrder` dynamic 1k–1M @ $0.0005/token, `createTokenPackageOrder`; price always server-derived; pending-order dedup via supersede), plus UI references in `app/store`, `app/checkout`, `app/play/[id]`, `app/privacy`, `app/profile`, `app/terms`, `lib/security/canary.ts`, `lib/supabase/server-admin.ts`.
- **Flow**: action inserts `payments` row (pending, order_id `{plan}-uuid` / `tokens-uuid`) → `createInvoice` → hosted invoice URL → IPN → webhook: HMAC-SHA512 over raw body → lifecycle filter (confirmed/payment_confirmed/finished; terminal failed/expired/refunded) → API cross-check → same-currency underpayment check (1% tolerance) → **atomic claim** (`status≠confirmed,refunded` guard) → `grant_vip`/`credit_tokens` → ledger insert `nowpayments_events` (best-effort, post-grant) → notification. Claim released on grant failure (retryable).
- **Env**: `NOWPAYMENTS_API_BASE` (default api.nowpayments.io), `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` — on Vercel MAIN **and** DB-overridable via `platform_settings.nowpayments_*`.
- **DB**: `payments`, `nowpayments_events`, `token_transactions` (reason=purchase/vip_grant), `profiles.tokens_balance/is_vip/vip_expires_at`.
- **Live** `[TESTED]`: POST unsigned → 400, no grant. `/store`, `/checkout`, `/premium` all 200.

### 4b. PayRam (self-hosted card→crypto onramp, USDC on Base) — RECOMMEND REMOVE (user pre-confirmed)

- **Code** `[READ]`: `app/api/payram/webhook/route.ts` (349 L), `lib/payram/server.ts` (187 L: `createPayment`, `getPaymentStatus`, `isAmountAcceptable`, HMAC-SHA256 `verifyWebhookSignature` over raw body, `X-Payram-Signature` + legacy `api-key` header), `lib/actions/payram.ts` (156 L: `pr-{plan}-uuid` order refs; customer_id = user id; stores gateway reference into `payments.payment_id`), `app/checkout/page.tsx`, `app/store/page.tsx`, `lib/billing/constants.ts` (shared).
- **Flow**: like NOWPayments plus gateway status-API cross-check, customer match, USD amount tolerance; atomic claim; `grant_vip`/`credit_tokens`; notifications. Order-ref regex `pr-[a-z_]+-[0-9a-f-]{10,}`.
- **Env**: `PAYRAM_API_BASE`, `PAYRAM_API_KEY` (env only — NOT in platform_settings).
- **DB**: same `payments` table.
- **Live** `[TESTED]`: POST unsigned → 400. Local gateway container up on 127.0.0.1:8788 (payramapp/payram:latest, Postgres inside; logical dump preserved in backup).

### 4c. Self-hosted gateway infrastructure — REMOVE (user pre-confirmed)

- Docker `payram` container (127.0.0.1:8788), `~/.payram-core` (aes-key.txt, uploads/, db/), cloudflared tunnel process (no public DNS route exists anymore — `pay.sweetscene.love` NXDOMAIN). Backups: `payram-db-2026-11-06.sql` (logical, 80 tables) in `/home/void/Sweetscene Dev Backup/payram-core-pgdump/` + GitHub release asset.
- `~/.payram-core` stays on disk unless user says delete (standing decision).

### 4d. What STAYS (shared billing backbone — reused by Stripe in Phase 2)

`payments` table (order tracking; Stripe can reuse `order_id` = Payment Link client_reference_id/session id), `token_transactions` ledger, `credit_tokens` + `grant_vip` RPCs (**exactly implement the Phase 2 grant semantics already**: exact token amount; VIP `greatest(now, current)+days`), `lib/billing/constants.ts` product catalogue (TOKEN_PACKAGES starter 10k/$4.99 · standard 50k/$19.99 · whale 100k/$34.99; DYNAMIC rate; VIP_PLANS vip_monthly $9.99/30d sub, vip_yearly $99.99/365d sub, vip pass $9.99/30d), `lib/notifications/dispatch`, `lib/utils/ratelimit`, `app/api/cron/subscription-reminders` (reads `profiles.vip_expires_at`, sends renewal nudges — keep, works identically under Stripe), atomic-claim webhook pattern (port to Stripe event-id idempotency per plan).

## 5. Security observations

1. `.env.staging` is **git-tracked** — contains only non-functional canary placeholders, but tracking any env file invites future leaks. Phase 1: `git rm --cached` + gitignore. `[READ]`
2. `sweetscene-details.env` (user's file, outside repo): contains many real key names incl. PAYRAM + Supabase/Vercel/CF/R2/Google/admin creds; its GITHUB_TOKEN + VERCEL tokens are **stale (401/403)**. `[TESTED]`
3. Pasted DESIGN Vercel token: scoped to nothing (empty project list) — dead. Pasted MAIN Vercel token: works. Pasted Supabase tokens: reach only paused projects. `[TESTED]`
4. No token I hold can manage the two **live** Supabase projects — blocks Phase 3 (db push / pg_dump restore) until resolved. `[TESTED]`
5. `platform_settings` can hold `nowpayments_api_key` / `nowpayments_ipn_secret` — Phase 1 revocation must cover DB rows, not just env. `[READ lib/config/settings.ts]`
6. Schema inconsistency `[READ]`: `payments.status` CHECK = pending/confirmed/failed/expired, but NOWPayments webhook writes `refunded` — live DB CHECK likely differs from schema.sql (verify in Phase 3 when DB access exists; additive fix only).
7. Canary honeytokens (`CANARY_TOKENS`) active in both webhooks — good; keep mechanism for Stripe webhook. `[READ lib/security/canary.ts]`

## 6. Anomalies (non-payment, observed)

- **`https://www.sweetscene.love/` (and `ss.`) return HTTP 200 but render the Next.js `_not-found` page ("404 — This page could not be found.", noindex)** — production deploys branch `main`, which apparently lacks `app/page.tsx` (homepage lives on unmerged `homepage-redesign`). `[TESTED]` Not payment-related; flagged for user awareness — merging `homepage-redesign` → `main` would presumably restore the homepage. No action taken (MAIN untouched).
- `admin.sweetscene.love` verified in Vercel but NXDOMAIN in DNS — the DNS record was removed/never published at Namecheap. Phase 4 prerequisite either way. `[TESTED]`
- `DEPLOY.md` serving model (VPS+tunnel) outdated vs reality (Vercel). `[READ]`

## 7. Remove / shelve recommendation (user PRE-CONFIRMED 2026-11-06: "remove payram and all the payment gateway method")

| Item | Verdict |
|---|---|
| NOWPayments code + env + webhook endpoint | **REMOVE** (Phase 1) — re-add guide `deploy-guide/nowpayments-readd.md` |
| PayRam code + env | **REMOVE** (Phase 1) |
| Self-hosted gateway (container, tunnel, ~/.payram-core) | **STOP** container+tunnel; folder kept on disk (standing decision); backups preserved |
| `payments` / `nowpayments_events` / `token_transactions` historical rows | **READ-ONLY, forever** — no DELETE/TRUNCATE |
| `grant_vip` / `credit_tokens` / billing constants / reminders cron / notifications | **KEEP** — Stripe Phase 2 backbone |

## 8. Decisions & credentials needed from user ([NEEDS ME] — blocks later phases, not Phase 1 code work)

1. **Supabase access**: provide a token (or re-scope) covering the LIVE projects `vnugflrlzrvngopweixe` + `runjhpkyqcdbiijrqmfl` — current tokens only reach the two paused projects.
2. **Which Supabase project is DESIGN?** (a) unpause `ss design` (Sydney, empty?) or (b) use live `sweetscene-staging` `runjhpkyqcdbiijrqmfl` (currently holds dev data; `.env.local` points here).
3. **DESIGN Vercel project**: doesn't exist + design token dead → create it (needs a working token with project-creation scope) — OR give me a fresh token.
4. **DNS**: stay on Namecheap (Phase 3 CNAME there; no Cloudflare Access possible) or move nameservers to Cloudflare (enables Phase 4 Access on admin.sweetscene.love)? 
5. **Admin surface for Phase 4**: main-app `app/admin` (profiles.is_admin model) or separate `admin/` subproject (sweetscene-admin.vercel.app)?
6. Confirm homepage situation (§6): merge `homepage-redesign` → `main` before/after this project, or leave as-is?

## 9. Gate

**PHASE 0 COMPLETE — REVIEW ./migration-audit/phase0.md — WAITING FOR APPROVED**

Phase 1 (remove legacy payments on branch `remove-legacy-payments`) starts only after APPROVED. Nothing above changed code, DB, or infra.

## 10. ADDENDUM (2026-11-06, post-gate) — credential ↔ URL verification `[ALL TESTED via live API calls]`

Requested by user ("check with the url and stuff"). Every token was exercised against every system it could plausibly reach.

### 10.1 Vercel tokens

| Token (name only) | Account | Sees |
|---|---|---|
| VERCEL_TOKEN_MAIN (deploy.env) | wixiev7x-4663 / wixiev7x@gmail.com | projects `sweetscene` (prj_sQzO…) + `sweetscene-admin` (prj_sVER…) |
| VERCEL_TOKEN_DESIGN (deploy.env) | corruptnb-7175 / corruptnb@gmail.com, team "sweet" (team_6UAk…) | **0 projects anywhere** — valid token, EMPTY account → DESIGN Vercel project must be CREATED in Phase 3 |

- MAIN project deployments by branch: `main` → production ×3, `homepage-redesign` → preview ×3, `design` → preview ×1. Admin project: production `main` READY.
- `ss.sweetscene.love` anomaly (§6.4) RESOLVED: same project as www; stale Vercel edge cache (root age ≈11.5d vs www ≈5.7d). Non-issue; clears on next deploy.

### 10.2 Supabase tokens — labels are CROSSED in details.env

Management API (each token sees exactly ONE **PAUSED** project):

| Token (name only) | Project it controls | Region | Status |
|---|---|---|---|
| SUPABASE_TOKEN_MAIN (deploy.env, authoritative) | `zydwemwlzlrmghlpnqtp` "sweetscene" | Tokyo | INACTIVE (paused) |
| SUPABASE_TOKEN_DESIGN (deploy.env, authoritative) | `rcgxcxygoatdmpxnvnbu` "ss design" | Sydney | INACTIVE (paused) |
| SUPABASE_TOKEN_MAIN (details.env) | "ss design" Sydney | — | CROSSED label |
| SUPABASE_TOKEN_DESIGN (details.env) | "sweetscene" Tokyo | — | CROSSED label |

**Neither live project** (`vnugflrlzrvngopweixe` MAIN / `runjhpkyqcdbiijrqmfl` "sweetscene-staging" DESIGN) is reachable by ANY management token — they live on yet another account. However:

- **details.env per-project keys (URL + anon + service_role) WORK against BOTH live projects** — verified with real authenticated REST queries (service_role 200, anon 200). .env.local anon/URL == details DESIGN anon/URL.
- **Auth-admin API works** on staging with the DESIGN service key (`/auth/v1/admin/users` → 200): users can be created/managed programmatically for Phase 4 testing.
- NO Postgres/DB password exists in any env file → **no direct DDL path to either live project**. Staging DDL/migrations blocked unless: (a) user runs SQL in dashboard, (b) user provides the sbp token for the live-projects account, or (c) Phase 3 creates a FRESH project via a working sbp token with self-chosen `db_pass` (POST /v1/projects accepts it) → full psql DDL via `docker exec payram psql`, then REST-copy dev data (~17 rows).

### 10.3 Staging (DESIGN DB, runjhpkyqcdbiijrqmfl) — real live schema [READ via OpenAPI]

**27 tables** (superset of repo schema.sql): admin_audit_log, app_settings, audit_logs, bans, bots, bounties, character_ratings, characters, confessions, invite_links, match_characters_snapshot, match_partners, match_ratings, matches, matchmaking_queue, messages, moderation_queue, notifications, nowpayments_events, payments, platform_settings, profiles, reports, reputation_events, solo_sessions, token_transactions, user_blocks.

**74 RPCs incl. a full admin suite** (names ≤20 chars in OpenAPI): admin_ban_user, admin_unban_user, ban_user_with_reason, unban_user_with_reason, expire_ban, list_ban_history, admin_grant_tokens, admin_set_report_status, resolve_report, resolve_refund, get_admin_stats_v2, list_admin_users, list_audit_log, list_moderation_queue, resolve_moderation_item, list_admin_characters, admin_set_character_flag, admin_delete_character, is_super_admin, get_my_role, assert_current_user_admin, is_current_user_banned, credit_tokens, grant_vip, get_own_profile … → **much of Phase 4's SQL backend already exists on staging** (Phase 4 becomes: verify + fill gaps: token_version, bans.type/appeal_state, reports completeness, mod_actions).

Live columns differ from repo schema.sql (live is NEWER):
- `profiles`: **has `role` already** (no token_version — Phase 4 adds it); also age_verification_*, anonymous_*, reputation_*, ban_reason/banned_at/banned_until, earned_tags, connection_tickets.
- `payments`: amount, created_at, currency, id, order_id, payment_id, status, token_quantity, type, updated_at, user_id.
- `characters`: NO status/triggers/limits/tagline (Phase 5 adds); has full bot-authoring columns (system_prompt, first_message, example_dialog, backstory, version, visibility …).
- `bans`: active, created_at, expires_at, id, moderator_id, reason, user_id (NO type/appeal_state).
- `reports`: **has target_id/target_type/status** + resolution fields (richer than schema.sql).

Row counts [read-only]: profiles=6, matches=6, messages=4; characters/payments/token_transactions/bans/reports/moderation_queue/admin_audit_log = 0. **Payments EMPTY on staging** → the 'refunded' CHECK-inconsistency question is moot there (still to verify on MAIN in Phase 6).

### 10.4 Corrections to §3/§8 above

- "anon 401" probe finding was an artifact (root `/rest/v1/` behaves oddly for anon keys; real table queries 200). §3's "no token can access live projects" is refined: **no MANAGEMENT access, but REST/service access works** with details.env per-project keys.
- DNS unchanged: design/admin/pay.sweetscene.love all NXDOMAIN. www.sweetscene.love + sweetscene.vercel.app `/api/health` = 200 ok. sweetscene-admin.vercel.app = 200.
