# Phase 1 Report — Remove legacy payment gateways (Payram + NOWPayments)

Branch: **`remove-legacy-payments`** (base: `homepage-redesign` @ `b062986`)
Date: 2026-11-06
Rollback point: git tag **`gateway-base-usdc`** (annotated, created BEFORE any removal)

## Goal

Remove Payram and NOWPayments (crypto payments) from the whole project per
user directive ("remove payram and all the payment gateway method from the
whole project"). Historical payment data stays read-only. Card billing via
Stripe lands in Phase 2 on top of this branch.

## 1. What was removed [TESTED via `git status` + build route table]

**Deleted files** (all recoverable at tag `gateway-base-usdc`):
- `app/api/payram/webhook/route.ts` — PayRam webhook
- `app/api/nowpayments/webhook/route.ts` — NOWPayments IPN webhook
- `lib/payram/server.ts`, `lib/nowpayments/server.ts` — gateway clients
- `lib/actions/payram.ts`, `lib/actions/billing.ts` — purchase server actions
- `app/checkout/page.tsx` + `app/checkout/layout.tsx` — crypto checkout page

**Code references cleaned** (exact-match scripted edits, each asserted):
- UI CTAs: `/profile`, `/play/[id]`, `/store`, `/premium` → purchase buttons now route to `/billing` (placeholder until Phase 2)
- Legal/copy: `/terms`, `/privacy`, `/store` FAQ — crypto wording → card/Stripe wording
- `lib/config/settings.ts` — removed `nowpayments_api_key` + `nowpayments_ipn_secret` SETTING_KEYS and MANAGED_SETTINGS descriptors
- `lib/security/canary.ts` — removed the 2 NOWPayments honeytoken entries (mechanism kept for Stripe)
- `lib/billing/constants.ts` — comments made gateway-neutral (file KEPT: price table for Phase 2)
- Comments: cron route, age-verification webhook, `lib/supabase/server-admin.ts`
- `.env.example` — NOWPayments + PayRam sections removed, Stripe placeholder note added
- `admin/` subproject — payments viewer copy updated (viewer KEPT, reads historical rows)
- Docs: `SETUP.md`, `DEPLOY.md`, `To-Do.md` (Phase 8 marked SUPERSEDED), `LOVABLE.md`, `LOVABLE_PROMPT.md`

**Local infrastructure stopped [TESTED]**:
- Docker container `payram` — `docker stop payram` (Exited 137; container + volumes intact at `~/.payram-core`, restart: `docker start payram`)
- Cloudflare tunnel — systemd user unit `payram-tunnel.service` stopped + **disabled** (would auto-respawn on plain kill; restart: `systemctl --user start payram-tunnel && systemctl --user enable payram-tunnel`)
- `pay.sweetscene.love` was already NXDOMAIN in public DNS (registrar = Namecheap, no record) → the originally planned Cloudflare 301 redirect is MOOT — nothing to redirect. [TESTED DoH]

**Untracked `.env.staging`** — `git rm --cached .env.staging` + added to `.gitignore` (file contained only canary placeholders, no secrets — see Phase 0 §5). Also fixed malformed `.gitignore` line (`.vercelpayment-audit/` → separate `.vercel` + `payment-audit/` entries).

## 2. What was KEPT (deliberate)

- `payments`, `token_transactions`, `nowpayments_events` tables + ALL historical rows — read-only, zero DB writes performed anywhere (no DB credentials used in this phase)
- `lib/billing/constants.ts` (token packages, VIP plans, price table) — reused by Phase 2
- `app/api/cron/subscription-reminders` — gateway-agnostic (reads `profiles.vip_expires_at`)
- Historical payments viewer in `admin/` subproject
- `lib/config/settings.ts` override mechanism (descriptors trimmed only)

## 3. Verification [ALL TESTED locally]

| Check | Result |
|---|---|
| `npm run build` | **PASSES** — fresh BUILD_ID, route table clean |
| `/billing` in route table | ✔ present (static) |
| `/checkout` in route table | ✔ absent |
| `/api/payram/webhook`, `/api/nowpayments/webhook` | ✔ absent from route table |
| Local runtime: `GET /checkout` | **307 → /billing** (temporary redirect via `next.config.ts`) |
| Local runtime: `POST /api/payram/webhook` | **404** |
| Local runtime: `POST /api/nowpayments/webhook` | **404** |
| Local runtime: `GET /billing` | **200** |
| `grep -ri 'payram\|nowpayments'` (excluding payment-audit/, migration-audit/, deploy-guide/, node_modules/, .next/) | **0 matches** |
| cloudflared process | **not running** (`pgrep -x` empty; unit inactive) |
| payram container | **Exited** (docker ps -a) |
| Port 8788 (gateway admin API) | **unreachable** |

Production (sweetscene.love on Vercel) is **untouched** — it still serves the
last deploy of `main` until Phase 6 promotion. That is expected: the removal
takes public effect only when this branch reaches production.

## 4. [NEEDS ME] — dashboard-side deactivations (no API access from here)

1. **NOWPayments dashboard** — delete/rotate the API key so the (now-404)
   webhook can never be replayed against production. Names in
   `deploy-guide/env-manifest.md` §4a.
2. **PayRam gateway** — the wallet/admin credentials live in the stopped
   container; if you want them gone permanently, `docker rm payram` + delete
   `~/.payram-core` (say the word; nothing deleted yet per plan).
3. **platform_settings on MAIN** — `nowpayments_*` DB rows can only be
   cleared with production DB access; deferred to Phase 6 cleanup (MAIN is
   off-limits until "GO PRODUCTION").

## 5. Deviations from the original phase plan

- `/checkout` → chose **307 redirect to /billing** (plan allowed "clean 404 or redirect"); redirect is friendlier to any old links.
- Cloudflare 301 for `pay.sweetscene.love` → skipped as moot (hostname NXDOMAIN; zone not even in Cloudflare — registrar DNS is Namecheap).
- `/billing` is a temporary "card checkout coming back" placeholder page; the real Stripe page is Phase 2 on branch `stripe-link`.

## 6. Status

- Branch `remove-legacy-payments`: all changes staged/committed (see git log).
- Zero DB writes. Zero production changes. Zero secret values in git.
- Next: Phase 2 (Stripe Link billing) branches off this branch.

**PHASE 1 COMPLETE** (per user's blanket "finish everything" directive, proceeding without gate pause; MAIN untouched until "GO PRODUCTION").
