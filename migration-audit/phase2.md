# Phase 2 — Stripe Link billing (branch `stripe-link`)

**Date:** 2026-11-06 · **Base:** `remove-legacy-payments` @ 86562c8 · **Status:** code complete + locally verified; E2E on Stripe TEST account pending credentials.

## What was built

| Area | File(s) | Evidence |
|---|---|---|
| Webhook route (core) | `app/api/webhooks/stripe/route.ts` | [TESTED] local smoke: unsigned→400 `Invalid signature`, bogus `Stripe-Signature`→400, unconfigured→503 `Not configured` (fail-closed) |
| Signature verification | `lib/stripe/signature.ts` | [TESTED] 13 unit tests (34/34 suite pass) — valid/tampered/stale/future/multi-v1/wrong-secret/non-hex/boundary |
| Payment Links config | `lib/stripe/links.ts` | [READ] env→link mapping + availability probe (no secrets logged) |
| Server actions | `lib/actions/stripe-billing.ts` | [TESTED] tsc clean + build clean; auth→ratelimit→pending-row→link URL flow follows proven payram action pattern |
| /billing page | `app/billing/page.tsx` + `billing-client.tsx` | [TESTED] local 200, renders all cards; unconfigured links → "Coming soon" ×5; portal hidden until STRIPE_SECRET_KEY set |
| DB migration (additive) | `supabase/migrations/2026-11-06-01-stripe-billing.sql` + mirrored in `lib/supabase/schema.sql` | UNTESTABLE until applied to DESIGN DB (no DDL access yet) |
| Env docs | `.env.example` (canary placeholders), `deploy-guide/env-manifest.md` §4b | [READ] |
| Copy updates | `app/premium`, `app/store`, `app/api/cron/subscription-reminders` comment | [READ] auto-renew/cancel-anytime wording |
| Bugfix | `lib/billing/constants.ts` `vipPlanFromOrderRef` now strips `stripe-` prefix too (was `pr-` only — yearly plan would have silently granted 30d) | [TESTED] logic traced |

## Security properties (webhook)

1. **Raw-body signature verify BEFORE parse** — HMAC-SHA256 of `${t}.${payload}`, ±300s tolerance, constant-time compare, multiple `v1=` candidates supported.
2. **Event-id idempotency** — `stripe_events` ledger upsert `ON CONFLICT DO NOTHING`; 0 rows returned = duplicate → 200 `{duplicate:true}`, no re-grant. Replay-safe.
3. **Atomic claim** — `payments` row update `.neq("status","confirmed")`; 0 rows = already confirmed. Grant failure → claim released back to `pending` → 500 → Stripe retry.
4. **Amount/currency check** — `|session.amount_total − payment.amount×100| > 1` → row marked `failed`, no grant.
5. **Fail-closed** — missing/invalid `STRIPE_WEBHOOK_SECRET` → 503, nothing parses.
6. Canary honeytokens + IP bruteforce throttle carried over from legacy webhooks.
7. 256KB body cap.

## Design decisions & deviations from plan (all deliberate)

| Plan said | Built instead | Why |
|---|---|---|
| `?client_reference_id={user_id}` | `client_reference_id = payments.order_id` (`stripe-{productId}-{uuid}`) | Payment Links can't carry arbitrary per-purchase metadata; order_id encodes product+user+price server-side and is the atomic claim anchor. Raw user_id alone couldn't disambiguate product/amount → the amount check would have nothing to validate against. |
| Handle `checkout.session.completed` + `customer.subscription.deleted/updated` | Those + `checkout.session.expired`, `invoice.paid`/`invoice.payment_succeeded` (renewal grants) | Without renewal grants, a charged cycle = money taken, no VIP time — worst failure mode. `sub.updated/deleted` are sync-only (never grant/cancel paid time). |
| one-time VIP pass available | Dropped from sale (subscription only) | Card billing model = auto-renew subscriptions; one-time pass was a crypto-gateway artifact. Code keeps `vip` plan in constants for history. |
| `STRIPE_LINK_VIP` single link | + optional `STRIPE_LINK_VIP_YEARLY` | Yearly plan is best-value; hidden when env unset. |

## Renewal grant logic (invoice.paid)

- Only `billing_reason=subscription_cycle` (create-cycle already granted at checkout → prevents double-credit).
- User resolved via `stripe_customers` (subscription_id → customer_id fallback; unmapped → 200 no-op).
- Days from `invoice.lines[0].price.recurring.interval` (month→30, year→365).
- Renewal payments row `stripe-sub-{sub}-{invoice.number|created}` upsert-dedupe → idempotent.
- `grant_vip` RPC reused → stacks days onto `vip_expires_at` (existing DB contract).

## [NEEDS ME] — Stripe TEST account setup (no Stripe keys exist anywhere per Phase 0 audit)

1. Stripe Dashboard (TEST mode) → Product catalog → create products/prices **exactly matching `lib/billing/constants.ts`**: VIP monthly $9.99/30d recurring, VIP yearly $99.99/365d recurring, starter $4.99, standard $19.99, whale $34.99 (one-time).
2. Payment Links → create 5 links (VIP monthly, VIP yearly, starter, standard, whale) → copy URLs → set env `STRIPE_LINK_VIP`, `STRIPE_LINK_VIP_YEARLY`, `STRIPE_LINK_TOKENS_S/M/L`.
3. Developers → Webhooks → add endpoint `https://<design-host>/api/webhooks/stripe` → copy signing secret → `STRIPE_WEBHOOK_SECRET` (must start `whsec_`).
4. Create restricted API key → `STRIPE_SECRET_KEY` (starts `sk_test_`) — needed for customer portal.
5. Settings → Billing → Customer portal → enable, return URL `/billing`.
6. E2E T1–T6 via Stripe CLI: VIP buy, token pack buy, replay event ×2 (credits once), parallel events, tampered signature (400, no credit), subscription cancel (paid time kept). Requires `stripe listen` forwarding to the DESIGN deployment.

## E2E status

- T1–T6: **UNTESTABLE** until Stripe TEST keys + deployed DESIGN host exist (both [NEEDS ME] above + Phase 3).
- Signature logic: covered by unit tests (13) [TESTED].
- Route contract: local smoke [TESTED] (400/400/503 + 200 `/billing`).

## Verification summary

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean [TESTED] |
| `npm run build` | success, `/billing` route present [TESTED] |
| `npm test` | 34/34 pass [TESTED] |
| `/billing` local | 200, "Coming soon" placeholders [TESTED] |
| Webhook 400 (unsigned / bad sig) | [TESTED] |
| Webhook 503 (unconfigured) | [TESTED] |
| grep legacy names | zero outside excluded dirs (unchanged from Phase 1) [TESTED] |

## Production impact

None — code exists only on branch `stripe-link`. MAIN deploy untouched (Phase 6, after "GO PRODUCTION"). DB migration not yet applied anywhere.
