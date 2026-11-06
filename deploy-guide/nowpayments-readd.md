# Re-adding NOWPayments (crypto payments) — contingency guide

> Written during the payment-consolidation migration (2026-11-06).
> Phase 1 removed Payram + NOWPayments in favor of a single Stripe card
> checkout (Phase 2). Nothing was destroyed: all removed code is
> recoverable **byte-for-byte** from git tag `gateway-base-usdc`.

## 1. Where the old code lives

- Git tag: **`gateway-base-usdc`** (annotated, points at the last commit
  before removal, on top of `homepage-redesign` @ `b062986`).
- Restore any single file:
  ```bash
  git checkout gateway-base-usdc -- app/api/nowpayments/webhook/route.ts
  ```
- Or diff the whole removal:
  ```bash
  git diff gateway-base-usdc..remove-legacy-payments --stat
  ```

## 2. Files removed in Phase 1

| File | Role |
|---|---|
| `app/api/nowpayments/webhook/route.ts` | IPN webhook (HMAC-SHA512, atomic claim, grants) |
| `lib/nowpayments/server.ts` | NOWPayments REST client (invoice create + status cross-check) |
| `lib/actions/billing.ts` | Server actions: `createVipPlanOrder`, `createTokenOrder`, `createTokenPackageOrder` |
| `app/api/payram/webhook/route.ts` | PayRam webhook (HMAC-SHA256, gateway cross-check) |
| `lib/payram/server.ts` | PayRam gateway client |
| `lib/actions/payram.ts` | Server actions for PayRam orders (`pr-…` refs) |
| `app/checkout/page.tsx` + `layout.tsx` | Crypto checkout page (now 307 → `/billing`) |

Kept (gateway-neutral, reused by Stripe Phase 2):

- `lib/billing/constants.ts` — token packages, VIP plans, price table
- `lib/config/settings.ts` — platform-settings override mechanism (NOWPayments descriptors removed)
- `lib/security/canary.ts` — honeytoken mechanism (NOWPayments entries removed)
- `payments` / `token_transactions` / `nowpayments_events` DB tables + all
  historical rows (read-only, untouched)
- `app/api/cron/subscription-reminders` — reads `profiles.vip_expires_at`, gateway-agnostic

## 3. Steps to re-enable crypto payments

1. **Code**: restore the files above from `gateway-base-usdc`, then
   re-apply the UI wiring that Phase 1 changed (purchase CTAs on
   `/store`, `/premium`, `/profile`, `/play/[id]` now point to `/billing`).
2. **Env**: re-add `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_API_BASE`,
   `NOWPAYMENTS_IPN_SECRET` (names documented in
   `deploy-guide/env-manifest.md` §4a; secrets never in git).
3. **Webhook**: re-register `https://<host>/api/nowpayments/webhook` in
   the NOWPayments dashboard (cPanel → Account Settings → IPN callback).
4. **platform_settings**: if keys were stored as DB overrides
   (`nowpayments_api_key`, `nowpayments_ipn_secret` rows), re-create them
   via the admin settings page (rows on MAIN were never deleted — they
   were only detached from code).
5. **PayRam gateway (self-hosted, optional)**:
   ```bash
   docker start payram              # container still exists, just stopped
   systemctl --user start payram-tunnel.service   # pay.sweetscene.love tunnel
   systemctl --user enable payram-tunnel.service  # if you want it at boot
   ```
   The tunnel + container were stopped/disabled 2026-11-06 (Phase 1);
   `pay.sweetscene.love` was already NXDOMAIN in public DNS before that.

## 4. What we did NOT keep

- The PayRam gateway's local Docker stack was stopped (container and
  volumes still on disk at `~/.payram-core`; untouched, restartable).
- Cloudflare tunnel for `pay.sweetscene.love`: stopped + disabled.
  No DNS record exists for that hostname at the registrar (Namecheap),
  so there is nothing to re-point.

## 5. Caveats

- Re-adding on MAIN after Phase 6 goes live means running TWO processors
  in parallel — review `lib/billing/constants.ts` for plan-id collisions
  (`vip_monthly` is shared vocabulary between gateways).
- NOWPayments refunds after a grant only *mark* the payment row — there
  is no automatic token claw-back (same as before removal).
