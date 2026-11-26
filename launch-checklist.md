# SweetScene launch checklist (Paddle era)

Updated 2026-11-26. Old Stripe-era log: `docs/launch-checklist-stripe-era.md`.
Rule: nothing touches MAIN (sweetscene.love, Supabase `vnugflrlzrvngopweixe`) until the owner types **GO PRODUCTION**.

## Done
- Legal: Terms, Privacy, Refunds, Guidelines, Cookie Policy, DMCA, Content & Age Statement
- 12 SEO blog posts + blog engine, JSON-LD, sitemap
- Security audit fixes, admin 2FA (aal2), AI/jailbreak hardening (`09e35f8`)
- Community points, weekly leaderboard + reward cron, scenarios
- Paddle billing code (replaces Stripe), SFW mode enforced server-side
- 12 SFW starter characters seeded on DESIGN (`scripts/seed-starter-cast.mjs`)
- Vercel Analytics wired in `app/layout.tsx`

## Owner actions [NEEDS ME]
| # | Item | Where it goes |
|---|------|---------------|
| 1 | Paddle seller account → API key, client token, webhook secret, 5 price IDs | Vercel env: `PADDLE_*`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` |
| 2 | DeepSeek top-up (~$5) + API key | Admin panel → AI settings |
| 3 | DNS for `design.sweetscene.love` (domain attached in Vercel, no DNS record yet) | CNAME `design` → `cname.vercel-dns.com` |
| 4 | `support@sweetscene.love` forwarding | Namecheap → Email forwarding |
| 5 | DESIGN env: `CRON_SECRET` (random 64 hex) | Vercel → sweetscene-design → Env |
| 6 | Enable Web Analytics on both projects | Vercel → project → Analytics → Enable |
| 7 | DESIGN env (optional): Turnstile + Upstash keys | same as MAIN's |

## MAIN pre-flight (read-only, 2026-11-26)
- Last MAIN deploy: 2026-11-11 (`a8f8421`). DESIGN code is 2 weeks ahead.
- MAIN DB: 0 characters, 6 profiles, missing `audience` / `age` / `hover_card` columns → all migrations since 2026-11-11 must be applied.
- MAIN env **missing**: `NEXT_PUBLIC_SFW_MODE` (**blocker** — without it MAIN runs NSFW-on), `CRON_SECRET` (crons fail closed), all `PADDLE_*`.
- MAIN env present: Supabase, AI key, moderation, Turnstile, Upstash, error webhook, NOWPayments, encryption key.
- MAIN env stale (remove at go-live): `PAYRAM_*`.

## GO PRODUCTION runbook (only after "GO PRODUCTION")
1. Dump MAIN DB → `./backups/main-<date>.sql`; note current deployment id for rollback.
2. Set MAIN env: `NEXT_PUBLIC_SFW_MODE=1`, `CRON_SECRET`, `PADDLE_*` (`PADDLE_ENV=production`).
3. Apply `supabase/migrations/*` newer than 2026-11-11 to MAIN, in order.
4. Seed starter cast on MAIN (`SEED_SUPABASE_URL` / `SEED_SERVICE_KEY` → MAIN).
5. `vercel deploy --prod` on project `sweetscene`.
6. Smoke test: `/api/health`, home, character sheet, login modal, chat send, `/billing`, legal pages, SFW grep = 0.
7. If anything fails → `vercel rollback <previous id>`, restore dump if migrations broke data.

## After launch
- Marketing; CCBill (NSFW) later; xchats-style character profile game.
- DB backups: scheduled dump (needs DB password in `~/.sweetscene-deploy.env`).
