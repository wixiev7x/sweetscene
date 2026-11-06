# SweetScene — Environment Variable Manifest

Created: 2026-11-06 (Phase 0) · Evidence: `[TESTED]` Vercel API env listing (MAIN project, production+preview scopes) · `[READ]` repo code + `.env.example` + `.env.local` + `.env.staging` + `admin/.env.example`

Legend for **Scope** column:

- **MAIN** — set on Vercel project `sweetscene` (production) `[TESTED via API]`
- **DESIGN** — to be set on the DESIGN (staging) Vercel project (does not exist yet — see phase0.md)
- **LOCAL** — only needed for local dev (`.env.local`); never deployed
- **REMOVE** — legacy payment keys deleted in Phase 1

> ⚠️ `platform_settings` DB table can **override** several env vars at runtime (DB value wins, 30 s cache) — see "Dashboard-overridable settings" below. A key can therefore be "set" in two places.

## 1. Supabase (core — every deployment)

| Var | MAIN | DESIGN | LOCAL | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ (= prod project `vnugflrlzrvngopweixe`) | ⬜ set to DESIGN DB | ✅ (= `runjhpkyqcdbiijrqmfl`, dev data) | Also used server-side by `lib/supabase/server-admin.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ⬜ | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (encrypted) | ⬜ | ✅ | Admin client; never DB-overridable (bootstrap circularity) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | ❌ not on Vercel | — | — | Unprefixed aliases read by some code paths; documented nowhere in `.env.example` — consolidation candidate |

## 2. AI / content generation

| Var | MAIN | DESIGN | LOCAL | Notes |
|---|---|---|---|---|
| `AI_API_KEY` | ✅ | ⬜ | ✅ | Overridable via `platform_settings.ai_api_key` |
| `AI_PROVIDER` | ✅ (deepseek in local) | ⬜ | ✅ (deepseek) | |
| `DEEPSEEK_ENDPOINT` | ✅ | ⬜ | ✅ | Overridable via `platform_settings.ai_endpoint` |
| `GEMINI_API_KEY` | ✅ | ⬜ | ✅ | Overridable via `platform_settings.gemini_api_key` |
| `GEMINI_ENDPOINT` | ✅ | ⬜ | ✅ | |
| `POLLINATIONS_API_URL` | ✅ | ⬜ | ✅ | |

## 3. Moderation

| Var | MAIN | DESIGN | LOCAL | Notes |
|---|---|---|---|---|
| `MODERATION_PROVIDER` | ✅ | ⬜ | ✅ (none) | Overridable via `platform_settings.moderation_provider` |
| `MODERATION_API_KEY` | ✅ | ⬜ | ✅ | Overridable |
| `MODERATION_ENDPOINT` | ✅ | ⬜ | ✅ | Overridable |
| `MODERATION_FAIL_CLOSED` | ✅ | ⬜ | ✅ | Overridable |

## 4. Payments

### 4a. Legacy (REMOVE in Phase 1 — user directive 2026-11-06)

| Var | MAIN today | Action |
|---|---|---|
| `PAYRAM_API_BASE` | ✅ | Phase 1: delete from Vercel + code |
| `PAYRAM_API_KEY` | ✅ | Phase 1: delete + `[NEEDS ME]` revoke at gateway |
| `NOWPAYMENTS_API_BASE` | ✅ | Phase 1: delete (also set in `.env.local`) |
| `NOWPAYMENTS_API_KEY` | ✅ | Phase 1: delete + revoke in NOWPayments dashboard + **check `platform_settings.nowpayments_api_key` row** |
| `NOWPAYMENTS_IPN_SECRET` | ✅ | Phase 1: delete + revoke + **check `platform_settings.nowpayments_ipn_secret` row** + delete IPN webhook endpoint |

### 4b. Stripe (ADD in Phase 2)

| Var | MAIN | DESIGN | Notes |
|---|---|---|---|
| `STRIPE_LINK_VIP` | Phase 2/3 (TEST) → Phase 6 (LIVE) | ⬜ | Payment Link URL — VIP monthly subscription ($9.99/30d) |
| `STRIPE_LINK_VIP_YEARLY` | Phase 2/3 (TEST) → Phase 6 (LIVE) | ⬜ (optional) | Payment Link URL — VIP yearly subscription ($99.99/365d); card hidden when unset |
| `STRIPE_LINK_TOKENS_S` / `_M` / `_L` | Phase 2/3 (TEST) → Phase 6 (LIVE) | ⬜ | Payment Link URLs for token packs (maps to starter 10k/$4.99, standard 50k/$19.99, whale 100k/$34.99 — MUST match `lib/billing/constants.ts`) |
| `STRIPE_WEBHOOK_SECRET` | Phase 2/3 (TEST) → Phase 6 (LIVE) | ⬜ | `whsec_…` for `/api/webhooks/stripe` (raw-body HMAC verify + event-id idempotency) |
| `STRIPE_SECRET_KEY` | Phase 2/3 (TEST) → Phase 6 (LIVE) | ⬜ | Customer-portal session creation ("Manage subscription"); also used to confirm payment intents if ever needed |

## 5. Security / abuse

| Var | MAIN | DESIGN | LOCAL | Notes |
|---|---|---|---|---|
| `TURNSTILE_SECRET_KEY` | ✅ | ⬜ | ✅ | Overridable via `platform_settings.turnstile_secret_key` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ✅ (encrypted) | ⬜ | ✅ | Inlined at build time — never DB-overridable |
| `NEXT_PUBLIC_TURNSTILE_SCRIPT_URL` | ❌ not on Vercel | — | — | Read by code; not in `.env.example` (optional override) |
| `TURNSTILE_VERIFY_URL` | ❌ not on Vercel | — | — | Read by code; not in `.env.example` (optional override) |
| `CANARY_TOKENS` | ✅ | ⬜ | — | Honeytokens (`lib/security/canary.ts`); values in `.env.example` are fake by design |
| `MESSAGE_ENCRYPTION_KEY` | ✅ | ⬜ | ✅ | Never DB-overridable (encryption-at-rest rule) |

## 6. Age verification

| Var | MAIN | DESIGN | LOCAL | Notes |
|---|---|---|---|---|
| `AGE_VERIFICATION_API_KEY` | ❌ **NOT on Vercel MAIN** | ⬜ | — | Read by code + `.env.example`; appears unset in production |
| `AGE_VERIFICATION_PROVIDER` | ❌ NOT on Vercel MAIN | ⬜ | — | Same |
| `AGE_VERIFICATION_WEBHOOK_SECRET` | ❌ NOT on Vercel MAIN | ⬜ | — | `app/api/age-verification/webhook` exists — verify feature is actually live before Phase 3 |

## 7. Infra / misc

| Var | MAIN | DESIGN | LOCAL | Notes |
|---|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | ✅ / ✅ | ⬜ | ✅ (empty → in-memory fallback) | Overridable via `platform_settings` |
| `ERROR_WEBHOOK_URL` | ✅ | ⬜ | ✅ | Overridable |
| `UNSPLASH_FALLBACK_IMAGE` | ✅ | ⬜ | ✅ | |
| `NEXT_PUBLIC_SITE_URL` | ✅ (encrypted) | ⬜ (`https://design.sweetscene.love`) | ✅ (localhost:3000) | |
| `NODE_ENV` | — | — | — | Framework-managed |

## 8. Admin subproject (`admin/` → Vercel `sweetscene-admin`) `[READ admin/.env.example]`

| Var | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Same values as MAIN app |
| `SETTINGS_MASTER_KEY` | Master key for settings encryption in the admin app |

## 9. Dashboard-overridable settings (`platform_settings` table) `[READ lib/config/settings.ts]`

`ai_api_key`, `ai_endpoint`, `ai_model`, `gemini_api_key`, `nowpayments_api_key`, `nowpayments_ipn_secret`, `turnstile_secret_key`, `upstash_redis_rest_url`, `upstash_redis_rest_token`, `error_webhook_url`, `moderation_provider`, `moderation_api_key`, `moderation_endpoint`, `moderation_fail_closed`.

DB row wins over env var, 30 s cache, rotated from the admin dashboard. **Phase 1 must also clear the two `nowpayments_*` rows here (SHOW + UPDATE, never print values).**

## 10. Local env files in repo

| File | Git-tracked? | Contents |
|---|---|---|
| `.env.example` | yes | All var NAMES; values are deliberate fake canaries (honeytokens) |
| `.env.local` | no | Points to Supabase `runjhpkyqcdbiijrqmfl` (dev data), localhost:3000 |
| `.env.staging` | **yes — BAD** | Canary placeholders only (`c4n4ry-staging…`), non-functional; Phase 1 untrack candidate |

## 11. DESIGN deployment checklist (Phase 3 — condensed)

1. Create/identify DESIGN Vercel project (none exists today — see phase0.md).
2. Set every ⬜ above with **DESIGN-scope values** (separate Stripe TEST keys, separate Supabase DESIGN project URL/keys, `NEXT_PUBLIC_SITE_URL=https://design.sweetscene.love`).
3. Do NOT copy `SUPABASE_SERVICE_ROLE_KEY` or any MAIN secret into any client-visible surface; after build, grep the client bundle for every secret (Phase 3 verification step).
