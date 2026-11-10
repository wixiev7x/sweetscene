# RESTORE-CRYPTO.md — bringing crypto checkout back, beside Stripe

> Contingency plan. Use only if Stripe refuses live activation (see
> `migration-audit/final-sweep.md` §7 / launch STEP 9 risk briefing).
> Docs only — nothing in this file changes code by itself.

## 1. What exists right now

- Git tag **`gateway-base-usdc`** (NEVER delete): the last commit before Phase 1
  removed the crypto gateways. It contains the complete, working PayRam +
  NOWPayments integration.
- Full file-by-file removal record: `deploy-guide/nowpayments-readd.md` (written
  during Phase 1) + `migration-audit/phase1.md` (what was removed and why).
- DB tables **still intact on every environment**: `payments`,
  `nowpayments_events`, `token_transactions` — historical rows preserved
  read-only. No DDL is required to restore the code.
- On disk: `~/.payram-core` (self-hosted gateway, kept), full backups
  (`/home/void/Sweetscene Dev Backup` + GitHub private
  `wixiev7x/sweetscene-dev-backup`, releases `backup-2026-11-06` +
  `backup-2026-11-09`).
- Stopped infra: docker container `payram` (stopped Phase 1) and systemd user
  unit `payram-tunnel.service` (stopped + disabled Phase 1).

## 2. Restore steps (crypto BESIDE Stripe, not replacing it)

1. **Branch:** `git checkout -b restore-crypto` (from the then-current branch).
2. **Pull the removed code back from the tag:**
   ```bash
   git checkout gateway-base-usdc -- \
     app/api/payram app/api/nowpayments \
     lib/payram lib/nowpayments \
     lib/actions/payram.ts lib/actions/billing.ts \
     app/checkout
   ```
   This stages the old files without touching anything else on the branch.
3. **UI:** re-add the crypto CTAs beside Stripe. Today `/billing`
   (app/billing/*) is Stripe-only via Payment Links; the old checkout flow
   returned an `invoiceUrl` from `createVipPlanOrder` /
   `createTokenPackageOrder`. Offer both: "Pay by card (Stripe)" primary +
   "Pay with crypto" secondary on /billing, /store, /premium, /profile.
4. **Env keys** (values from `deploy-guide/env-manifest.md` §4a; set per
   environment in Vercel + `.env.local`):
   `PAYRAM_API_BASE`, `PAYRAM_API_KEY`, `NOWPAYMENTS_API_BASE`,
   `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`.
5. **DB check before enabling:** repo schema's `payments.status` CHECK allows
   `pending|confirmed|failed|expired`, but the old NOWPayments webhook also
   wrote `refunded` on refunds. On the live DBs the CHECK may or may not
   include `refunded` — verify with
   `select pg_get_constraintdef(oid) from pg_constraint where conname like 'payments%';`
   If `refunded` is missing, either extend the CHECK or patch the webhook's
   refund branch before going live.
6. **Restart infra:**
   ```bash
   docker start payram
   systemctl --user enable --now payram-tunnel.service
   ```
7. **DNS:** `pay.sweetscene.love` was never publicly resolvable (NXDOMAIN,
   zone at Namecheap, not Cloudflare). If the tunnel should be public again,
   create the DNS record for the cloudflared tunnel at the registrar first.
8. **Webhooks:** re-register the IPN/webhook URLs in the NOWPayments dashboard
   (`<site>/api/nowpayments/webhook`) and the PayRam gateway admin
   (`127.0.0.1:8788`) — both were revoked/lost at removal time.
9. **Test with the smallest possible amount** end-to-end (order → webhook →
   `payments` row `confirmed` → tokens/VIP granted) on DESIGN before MAIN.
10. **Stripe stays on** simultaneously — nothing in this plan disables
    `/billing` Stripe links or the Stripe webhook.

## 3. Risks to review before doing this

- Two payment paths = two webhook surfaces to keep signed and idempotent.
- The `payments` table is shared; order-id formats distinguish sources
  (`stripe-*` vs `pr-*` / NOWPayments ids) — keep `vipPlanFromOrderRef`
  aware of both prefixes (it already strips `stripe-` and `pr-`).
- Crypto processors + adult-adjacent content: re-check the processor's
  ToS the same way we check Stripe's in STEP 9.

Pointers: `deploy-guide/nowpayments-readd.md` · `migration-audit/phase1.md` ·
tag `gateway-base-usdc`.
