# accounts.md — every service SweetScene reads, what it costs, how to sign up

> One row per service the code actually uses (grounded in `.env.example` +
> `deploy-guide/env-manifest.md`, verified 2026-11-10). Default = FREE tier.
> Status legend: ✅ we already have it · 🔑 you need to sign up / top up.

| # | Service | Status | Why the app needs it | Monthly cost | Signup link | What to click | What you paste back to me (KEY NAME only) |
|---|---|---|---|---|---|---|---|
| 1 | Supabase | ✅ HAVE | Database, auth, storage, RLS. DESIGN=rcgxcxygoatdmpxnvnbu, MAIN=vnugflrlzrvngopweixe | $0 (free tier: 500 MB DB, 50 K MAU) | — (existing) | nothing | nothing — keys already in Vercel env |
| 2 | Vercel | ✅ HAVE | Hosting. DESIGN=sweetscene-design (corruptnb/sweet14 team), MAIN=sweetscene (wixiev7x) | $0 Hobby | — (existing) | nothing | nothing |
| 3 | Stripe | 🔑 NEEDED (STEP 5) | Card checkout via Payment Links + webhook billing | $0 to open; live fees ~2.9%+30¢/charge | dashboard.stripe.com/register | register → verify email → we do the rest in TEST mode together (STEP 5 click-path) | STRIPE_LINK_VIP, STRIPE_LINK_VIP_YEARLY, STRIPE_LINK_TOKENS_S/M/L, STRIPE_SECRET_KEY (sk_test_…), STRIPE_WEBHOOK_SECRET (whsec_…) |
| 4 | DeepSeek | 🔑 TOP-UP (STEP 6) | AI chat model (AI_PROVIDER=deepseek) | pay-as-you-go; ~$5 lasts a long time at current usage | platform.deepseek.com | login → Billing/Top-up → add ~$5 → API Keys → Create | you paste the key into ADMIN panel → Settings → AI settings (never into code); key NAME to confirm: AI_API_KEY |
| 5 | Cloudflare Turnstile | 🔑 OPTIONAL, recommended | Bot protection on login/signup (NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY) | $0 (free, unlimited) | dash.cloudflare.com → Turnstile | add site → widget type Managed → copy site key + secret key | NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY |
| 6 | Upstash | 🔑 OPTIONAL, recommended | Redis rate limiting (UPSTASH_REDIS_REST_URL/TOKEN). Without it rateLimit degrades gracefully but invites are unprotected at scale | $0 (10 K commands/day free) | console.upstash.com → Redis | create database (Regional, free) → copy REST URL + token | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN |
| 7 | Email (Resend or any SMTP) | ⏸ LATER | Supabase auth uses its BUILT-IN mailer for signup/reset emails (rate-limited ~2/s) — fine for invite-only soft launch. Custom SMTP/Resend only if deliverability hurts | $0 free tier (3 K mails/mo) | resend.com | — when needed: Supabase Dashboard → Authentication → SMTP settings | nothing now — flagged, decided post-launch |
| 8 | Error tracking (Sentry or a webhook) | ⏸ OPTIONAL | Code reads one generic ERROR_WEBHOOK_URL (any Slack/Discord webhook URL works; no Sentry SDK in the app) | $0 free tier | — | — when wanted: paste any webhook URL | ERROR_WEBHOOK_URL |
| 9 | Pollinations | ✅ FREE, no key | Character avatar generation (POLLINATIONS_API_URL) | $0 | — (keyless) | nothing | nothing |
| 10 | Unsplash | ✅ FREE, no key | Fallback imagery (UNSPLASH_FALLBACK_IMAGE) | $0 | — (keyless) | nothing | nothing |
| 11 | Age verification provider | ⏸ LATER (STEP 8 lists for MAIN) | AGE_VERIFICATION_PROVIDER/API_KEY/WEBHOOK_SECRET — external ID-check service; app has 18+ cohort gating built in without it | varies | — | — decide before public marketing (Nov 30) | AGE_VERIFICATION_* |
| 12 | Moderation classifier | ⏸ OPTIONAL | MODERATION_PROVIDER/API_KEY/ENDPOINT — without it the app falls back to keyword-floor moderation (built in) | $0 free tiers exist | — | — | MODERATION_* |

**Minimum to reach soft launch (Nov 16):** rows 3 + 4 only.
**Recommended before public marketing (Nov 30):** rows 5 + 6 (+ decide 7/11).

Already-held credentials (never echoed): GitHub PAT (backups), Vercel MAIN +
DESIGN deploy tokens, Supabase MAIN + DESIGN management tokens, per-project
Supabase anon/service keys for both live projects — see
`/home/void/.sweetscene-deploy.env` + `sweetscene-details.env` (local only).
