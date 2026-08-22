# Sweetscene — Lovable AI Starter Prompt

> Paste this whole file as your **first message** in Lovable after importing the
> `sweetscene` repo from GitHub. Update the 3 `[PLACEHOLDER]` lines at the top with
> your actual GitHub repo URL, target domain, and Supabase region before pasting.

---

## 0. Your Repository & Goal

- **GitHub repo to import:** `[PASTE-REPO-URL-HERE]`
- **Production domain:** `[yourdomain.com]` (not purchased yet — pick any but
  tell me before generating OAuth redirect URLs)
- **Supabase region:** `ap-south-1` (Mumbai) — cannot change later, must match my
  VPS location in India
- **Goal:** Take this ~half-finished, security-hardened Next.js app and ship the
  **UI / animation / mobile / PWA** polish pass + wire the **NOWPayments crypto
  token** purchases + add the few **missing legal pages** so it can launch.

You (Lovable) are *only* doing **frontend, UI, animations, transitions, mobile
responsiveness, design-system polish and PWA** work. Do NOT touch backend,
auth, security, AI, moderation, payments, or Supabase RPC code. Those are
owned by hand-written server actions and are explicitly off-limits (see
§7).

---

## 1. What This Project Actually Is

**sweetscene.love** — an anonymous AI roleplay matchmaking *dating* platform.

- Two real humans get **matched anonymously** into a shared scene hosted by
  1–3 AI characters ("an AI director + third wheel").
- They roleplay together until a shared **token pool depletes**.
- When tokens run out, a **"Fade to Black"** dual-consent reveal fires: both
  users tap a secret button; only if *both* pressed does the partner's identity
  reveal. If both keep tapping "stay in" they unlock **DM** each other after
  the scene. Either can leave alone.
- **SFW floor by default.** **NSFW mode gated to `age_cohort='adult'` users
  only — gate is enforced SERVER-SIDE in `AgeCohortGate` + RPCs; the UI toggle
  only narrows what the user sees, it cannot widen beyond their cohort.**
- Floor 16+ (the To-Do.md still says 13+ in places — that's a bug to reconcile;
  treat 16+ as the truth)
- Stack-built reference sites for vibe:
  - **ourdream.ai** — AI roleplay with character cards (tagged MILF / teen / RPG
    / dominant / group etc.), end-to-end encrypted chat, **"dreamcoins"** token
    system ($9.99 yearly OR $19.99 monthly, both unlimited msgs + image/video +
    1000 dreamcoins/mo). Our pricing should be **smallest tier: $2–3 for ~5
    image gens + a chunk of text tokens** (much cheaper, micro-payments).
  - **muah.life** — instant crypto-style games sidebar (Slots, Lootbox, Dice,
    Mines, Coinflip, Keno, Crash, X100, X30 multiplayer, **BlackJack**).
    *Note:* muah.life disclaims "NOT gambling, tokens have no cash value" —
    we are the **OPPOSITE**: real crypto in, real cash out.

**sweetscene.bet** — a **separate** but **tokenically unified** site (in plan).
The same in-platform **"dreamcoins"** that you buy on **sweetscene.love** for AI
chats can be carried over to **sweetscene.bet** and used for real-crypto
gambling — Slots, Blackjack against **AI girls** (the AI narrator from
.love IS the dealer), Dice, Crash, Coinflip etc. Withdrawals back to real
crypto. This is the **big vision:** a unified token economy spanning the
roleplay site (where tokens are spent on AI turns/images) and the casino
(where tokens bet for real money). Treat .bet as out-of-scope for now but
remember that the **dreamcoins ledger must be designed so a second site can
read it later.**

## 2. Current Codebase State — Read These Files First

After import, **read these in this order before writing any code:**

1. `LOVABLE.md` — the design handoff doc (brand tokens, components list, routes,
   do-not-touch rules, good-first-tasks). **This is your design bible.**
2. `AGENTS.md` — project conventions (Next.js 16 caveats, doc-comment style,
   build/lint/test commands)
3. `SETUP.md` — env vars list, Supabase setup, post-deploy checklist, **the
   7 schema.sql migration blocks that are NOT yet applied** (these crash the app
   if you skip — see §6 below)
4. `DEPLOY.md` — VPS hosting plan (Cloudflare Tunnel, systemd, 4GB RAM)
5. `To-Do.md` — phase status (Phases 0–8A done; 8–13 pending)
6. `ISSUES.md` — security inventory
7. `lib/supabase/schema.sql` — the entire DB schema + the 7 unapplied blocks at
   the bottom

The **design playground** page is `/style-guide` (public, renders every token +
component with no data) — Lovable should use this as the live preview surface
for any rebrand/restyle.

## 3. What's Already Built (`~12,000` LOC, `50+` files)

- **Stack:** Next.js **16.2.9** App Router + React 19.2.4 + TypeScript ^5 +
  Tailwind v4 + `@supabase/ssr` 0.12 + `@supabase/supabase-js` 2 + `framer-motion`
  **12.42 (ALREADY INSTALLED)** + `@upstash/ratelimit` + `@upstash/redis` +
  `server-only`
- **Done phases:** 0 (security hardening), 1 (pluggable AI + mock), 2 (character
  creation + import/export), 3 (solo play persistence), 4 (play-while-waiting +
  AFK), 4.5 (message encryption + reports), 5 (security audit fixes), 6 (Vibe
  Check + reputation + smart refund), 7 (DMs hardening + user blocks), 8A
  (Character.AI-style fields + per-message tokens + paywall UI)
- **DB schema:** 1,607 lines, 12 tables, 15+ RPCs, all RLS + CHECK constraints,
  strict column-level REVOKE on sensitive columns
- **All `npx tsc --noEmit` + `npx eslint .` + `npm run build` pass clean TODAY.**
  Your job is: keep them clean after every change.
- Existing feature components: `ChatBox`, `MessageList`, `NotificationBell`,
  `FadeToBlack`, `AgeCohortGate`, `TurnstileWidget`
- Existing design-system components in `components/ui/` (barrel-exported via
  `components/ui/index.ts`): `Button`, `Badge`, `Avatar`, `TextField`,
  `TextArea`, `Modal`, `Spinner`, `LoadingState`, `Skeleton`, `ProgressBar`,
  `EmptyState`, `TypingDots`, `SiteNav`
- Existing routes: `/`, `/login`, `/legal/terms`, `/legal/privacy`,
  `/style-guide` (all public), then auth-required: `/lobby`, `/characters`,
  `/characters/[id]`, `/characters/my`, `/characters/[id]/edit`,
  `/create-character`, `/chat/[id]`, `/play/[id]`, `/dm/[id]`, `/profile`,
  `/admin`, `/admin/users`, `/admin/characters`, `/admin/reports`,
  `/admin/settings`
- PWA `app/manifest.ts` already exists; service worker NOT done yet
- Token economy + per-message pricing UI is **already wired**

## 4. What I Want YOU (Lovable) To Actually Do

### 4.1 Smooth scroll + animations + transitions

Reference sites I want to match in feel:
- **https://github.com/darkroomengineering/lenis** — README "recommended"
  library. **INSTALL LENIS** for smooth scrolling. Key facts I researched:
  - `npm i lenis`, then `import { ReactLenis } from 'lenis/react'` and wrap the
    app root in `<ReactLenis root autoRaf options={{ smoothWheel: true }}>`
  - Zero runtime deps, a few KB; wraps NATIVE scroll so `position: sticky`,
    anchor links, accessibility and the AI chat scroll container keep working
    (this is the #1 reason to pick it over locomotive-scroll)
  - **MUST use `data-lenis-prevent` attribute on every nested independently
    scrollable element** (the `ChatBox` scroll container, `MessageList`,
    modals, the character-list grid viewport) — without it Lenis hijacks nested
    scroll and chat becomes janky
  - Capped to 60 fps Safari / 30 fps low-power-mode → smooth without being
    laggy
- **https://animate-ui.com/** — animated React components, **framer-motion
  based**, shadcn-compatible via `npx shadcn add ...` CLI; use for entering
  modals, lists, page transitions
- **https://inspira-ui.com/** — shadcn-style registry of motion components
  (inspira's marquee, number-tick, typewriter, text-shimmer, dot-pattern,
  border-beam) — cherry-pick for landing + lobby marquee + reveal animations
- **https://antigravity.studio/** — animation inspiration (transitions,
  hover-tile effects, scroll-driven storytelling). DO NOT need to copy their
  SaaS — just study the *feel*
- **framer-motion is already installed** → wrap existing transitions:
  - `FadeToBlack` entrance (the dramatic NSFW consent reveal moment)
  - Vibe Check modal slide/scale
  - Match-found toast
  - Page route transitions (a soft fade between routes — keep under 250 ms so
    it doesn't feel slow)
  - Card hover for character cards on `/characters`

**Hard rules:**
- No GSAP, no ScrollTrigger, no Lottie bundles — these bloat the JS payload
  and break on low-end mobile. Lenis + framer-motion + animate-ui + inspira
  are enough.
- Test on a throttled CPU + 3G in Chrome DevTools after every animation change.
- All animations must respect `prefers-reduced-motion` → fall back to instant.
- **Perceived smoothness over actual smoothness** — if a 200 ms fade feels
  jankier than no animation, ship no animation.

### 4.2 Mobile responsiveness audit (PRIORITY)

The chat + lobby pages currently overflow horizontally on mobile. Fix:
- Audit every route with `devtools device toolbar` at iPhone SE (375×667),
  Pixel 7 (412×915), iPad mini (768×1024)
- Horizontal overflow → set `overflow-x: hidden` ONLY at the page wrapper, then
  hunt and fix the actual offending element with `min-w-0` / `truncate` /
  `flex-wrap` instead of hiding it
- Touch targets **≥ 44×44px** (Send button, character cards, match "stay/leave"
  buttons)
- No hover-dependent CTAs — every hover affordance must have a tap equivalent
- Sticky header on mobile = ~56 px tall, sticky composer on chat = ~64 px
- Test the chat `MessageList` scroll on a real Android if possible — Lenis's
  nested scroll is the riskiest change

### 4.3 PWA / installable

- `app/manifest.ts` already exists — verify it has name, short_name, theme_color
  = `--brand`, background_color, display `standalone`, start_url `/`, icons
  192 + 512 (generate from existing favicon). If it lacks these, fix.
- Add `app/sw.ts` Next.js 16 service worker for offline shell (App Router
  convention — confirm against `node_modules/next/dist/docs/` because this is
  Next 16 and the docs are the source of truth)
- Install button only on iOS Safari (no native install prompt) — add an "Add
  to Home Screen" banner per Apple's iOS install flow

### 4.4 Rebrand (still default tokens — change if you have a direction)

The current brand color lives in ONE place: `--brand` in `app/globals.css`. To
rebrand the whole app, change `--brand` + `--brand-light` + `--brand-dark` +
`--brand-deep` + `--brand-deepest`. See `LOVABLE.md` §Design Tokens for the
full list. The current colors are placeholder — pick a palette that:
- Says "anonymous late-night roleplay" — moody, dark, has a hint of danger
  without screaming adult
- Has WCAG AA contrast (4.5:1) for `--foreground` on `--background`,
  `--foreground-dim` on `--surface`, all semantic accents on dark/raised
- Doesn't read as a casino (no neon green-on-black). Sweetscene.bet gets the
  casino vibe; .love stays intimate.
- Validate the new palette on every component on `/style-guide` before
  touching any route

### 4.5 NSFW mode entry — visual treatment

The user explicitly toggles into NSFW mode (server re-verifies `age_cohort=
'adult'`). When toggled:
- Add a subtle "rose/pink ring" indicator only on adult surfaces, never on
  SFW surfaces (CSS only — no new tokens; this should reuse `--restricted` or
  `--accent` depending on which speaks "consensual adult" more)
- Keep the **CSAM/abuse absolutely forbidden** messaging visible; never make
  NSFW mode look like "anything goes"
- Image gen unlocks for adult users only; the `(NSFW)` toggle works the same
  way — never assume client-side flags, always ask the server

### 4.6 The few remaining real features (not polish)

Some are PARTIALLY done and you finish the UI layer only; the server side
is already there:

- **`/profile` "Become VIP" button** — currently a `handleBuyVIP` placeholder.
  Read `lib/nowpayments/server.ts` (exists) + `lib/actions/billing.ts`
  (`createVIPOrder`, `createTokenOrder` exist). Wire the button to call
  `createVIPOrder` → redirect to NOWPayments invoice URL.
- **`/play/[id]` paywall "Top Up" button** — wire to `createTokenOrder`. Show
  the SKU grid: "$2 = 5 image gens + X text tokens", "$5 = ...", "$10 = ...".
  Use **micro-tiers** as the user described — dream-style cheap micro-payment
  ($2–3 entry).
- **`/legal/terms` + `/legal/privacy`** — these routes exist but pages may be
  stubs. Fill with REAL ToS + Privacy content (the user is not a lawyer —
  generate a defensible first draft covering: anonymous matchmaking, NSFW
  adult content, payment processing via NOWPayments, encryption at rest via
  MESSAGE_ENCRYPTION_KEY, no logging of message content, age verification
  policy, CSAM reporting, 7-year payment record retention per Indian tax law).
  Mark clearly "Draft template — review with a lawyer before launch."
- **Login ToS checkbox + `tos_accepted_at`** — read Phase 9 spec in To-Do.md
- **NSFW opt-in popup** — read `setNsfwOptIn` spec; the popup must call the
  existing server action, not store the choice in localStorage
- **Admin dashboard** routes `/admin/users`, `/admin/characters`,
  `/admin/reports`, `/admin/settings` — read `lib/actions/admin.ts` if it
  exists (Phase 10 spec), wire those to the existing RPCs
- **`/style-page` "Notifications" bell** — read Phase 11 spec; UI shell can
  be built now, the realtime hook is wired later

For ANY of above, if `lib/actions/<file>.ts` doesn't exist yet, the action
may not be implemented yet — DO NOT implement it (it has `'use server'`
security implications, see §7). Stop and tell me which action is missing and
I'll have it added by hand. You only wire UI to existing actions.

## 5. Smooth / Lag-Free Performance Mandate

- Network: India VPS (3 Mbps upload) + Cloudflare edge for static; budget for
  real users on 4G Android with 2 GB RAM
- Lighthouse mobile targets: Perf ≥ 80, A11y ≥ 95, BP ≥ 90, SEO ≥ 95
- JS bundle: stay under **250 KB gzipped** initial. Lenis is ~5 KB, framer
  is the big one (already there). Avoid adding `gsap`, `three`, `lottie`,
  full `swiper`
- Animation fps: never animate `top/left/width/height/margin` — only
  `transform` + `opacity`
- Use `content-visibility: auto` on long character-list cards
- Lazy + eager-load only the next 1 image; load `<img loading="lazy">`
- Never `await fetch` inside render; keep server components where they are
- Service worker caches the static shell so a flaky network keeps the chat

## 6. ⚠️ SEVEN UN-APPLIED SCHEMA BLOCKS — TELL ME BEFORE DEPLOY

`lib/supabase/schema.sql` is **append-only**. **7 blocks NEAR THE END have NOT
been run against the live Supabase database yet** — without them, the app
breaks in different ways:

| Line  | Block | What breaks if skipped |
|------|-------|------------------------|
| 2649  | Server-authoritative age cohort | users self-set cohort |
| 2812  | Payments hardening (idempotency) | double webhooks double-credit tokens |
| 2870  | Ban enforcement + `platform_settings` | **app totally breaks** — `assertNotBanned()` fail-closed + admin/settings 404 |
| 3013  | Avatar URL hardening | any user IP-harvests every viewer |
| 3076  | Restores EXECUTE on `deduct_tokens` + `append_solo_messages` | **EVERY match says "Not enough tokens" + EVERY solo chat says "Failed to save message"** |
| 3116  | Account deletion: `payments.user_id` CASCADE → SET NULL | privacy violation |
| 3153  | Cohort-segregated matchmaking | **A 16-yr-old and a 35-yr-old in the same anonymous NSFW scene** |

These are **NOT** your job to apply (they're SQL, not UI). Your job is to
**wave a giant red flag at me** in the chat at deploy time: "Have you applied
all 7 schema.sql blocks 2649 → 3153 in order in Supabase SQL Editor?" — and
refuse to call 'done' until I confirm.

## 7. 🚨 Security Do-Not-Touch List (NON-NEGOTIABLE)

**The single rule that matters most:** `'use server'` at the top of a file
makes EVERY exported function a public HTTP endpoint callable by anyone
with attacker-controlled arguments. 4 historical vulnerabilities came from
exactly this. **NEVER** add `'use server'` to a file unless the existing
codebase pattern demands it. **NEVER** co-locate an internal helper in a
`lib/actions/*` file. **NEVER** refactor a file from `lib/utils`, `lib/notifications`,
`lib/ai`, `lib/nowpayments`, `lib/supabase` into `lib/actions/`.

Files off-limits to edit (restyle OK only where the file is a `.tsx`
component; never change behavior):

- `proxy.ts` (CSP + HSTS + auth gating; `frame-src` allows Turnstile iframe —
  removing breaks login)
- `lib/actions/**` (every export is a public endpoint, every one re-derives
  identity from session, NEVER add a userId param)
- `lib/notifications/dispatch.ts`
- `lib/utils/turnstile.ts`
- `lib/ai/prompts.ts` (fences untrusted character text between
  CHARACTER_BRIEF markers — reordering breaks the fence)
- `lib/ai/policy.ts`
- `lib/utils/safety.ts` (PII redaction, injection scrubbing, blocked terms —
  normalised comparison; do NOT "simplify" to substring test)
- `lib/utils/moderation.ts` (the AI content classifier)
- `lib/utils/url.ts` (avatar URL allowlist)
- `lib/supabase/schema.sql` (RLS + CHECK constraints)
- `lib/config/settings.ts` (runtime secret resolution)
- `app/api/nowpayments/webhook/route.ts` (payment IPN — signature-verified)

Two components that **look** presentational but **AREN'T** — restyle OK,
behavior locked:

- `AgeCohortGate` — enforces 18+ NSFW gate. You can reskin it. You CANNOT
  change **when** it renders or **what** it checks. The cohort is server
  truth, never client truth.
- `TurnstileWidget` — login captcha. Container can be styled but the widget
  must keep rendering and the CSP `frame-src` entry in `proxy.ts` must stay.

Other hard rules:

- Never hardcode a key/URL/model name. Secrets resolve at runtime from the
  `platform_settings` table → env fallback via `lib/config/settings.ts`,
  editable at `/admin/settings`. If you see `process.env.SOMETHING` outside
  of `lib/config/settings.ts`, that's a bug — tell me.
- NEVER use `NEXT_PUBLIC_` for secrets. Only for genuinely public values
  (site URL, Supabase anon key).
- Adding a new external image host means adding it to **three** places:
  `img-src` in `proxy.ts` AND the allowlist in `lib/utils/url.ts` AND the
  `is_safe_avatar_url` SQL function. Miss one and either images silently
  break OR a validation gap opens.
- Adding a new auth-required route = adding its prefix to `PROTECTED_PREFIXES`
  in `proxy.ts`.
- Adding a multi-step mutation = a new `SECURITY DEFINER` RPC in
  `schema.sql`, NOT an app-level conditional UPDATE — app updates race and
  leak auth. (This is past-me's job, not yours, but call it out if you see
  an `approve`/`reject` flow that mutates via client-supplied values.)

If you ever want to refactor a file from `lib/utils` or `lib/notifications`
into `lib/actions` for "cleaner organization" — **don't**. That refactor is
a security change, never a design change.

## 8. Next.js 16 Specific Warnings

**This is Next.js 16, not the Next.js you know** — APIs, conventions and
file structure have breaking changes vs your training data.

- Middleware is `proxy.ts` exporting a `proxy()` function, **NOT**
  `middleware.ts` exporting `middleware()`.
- `next lint` no longer exists — the lint script is `eslint`. Never invoke
  `next lint` in a build step.
- Before writing any Next.js framework code, read `node_modules/next/dist/docs/`
  — that's the source of truth.
- React 19 + `use()` / server components behave differently from React 18 docs
  you may have memorized
- Tailwind v4 (PostCSS plugin via `@tailwindcss/postcss`, no
  `tailwind.config.js` by default — config moved to CSS `@theme`)

## 9. After Every Single Change — Verify

```bash
cd /home/void/sweetscene && npm run build
# (= `next build` — must exit 0)

npx tsc --noEmit      # must exit 0
npx eslint .          # must exit 0, NOT `next lint`
```

One file per change. Match the existing code style: doc-comment on EVERY
function. When in doubt about a Next 16 convention, ask me before guessing.

## 10. Order Of First Tasks (recommended)

1. **Install Lenis + wrap root** (`app/layout.tsx`) with the `data-lenis-prevent`
   attribute added to `ChatBox`'s + `MessageList`'s scroll containers first.
   This is the one risky change — do it alone before bundling with anything else.
2. **Mobile audit + fix horizontal overflow** on `/chat/[id]` + `/lobby`.
3. **Wire framer-motion transitions** on `FadeToBlack`, Vibe Check modal,
   match-found toast, character-card hover, route fade.
4. **Rebrand** `--brand` palette (validate on `/style-guide`).
5. **PWA**: verify `app/manifest.ts`, add service worker.
6. **Wire `/profile` "Become VIP" + `/play/[id]` "Top Up"** to existing
   `lib/actions/billing.ts` actions + design the micro-tier SKU grid.
7. **Fill `/legal/terms` + `/legal/privacy`** with real draft content.
8. **Admin dashboard** pages wired to `lib/actions/admin.ts`.
9. **NotificationBell** UI shell (realtime later).
10. **Final Lighthouse + reduced-motion + slow-Android pass**.

At the end of each task: report file changed, output of `npm run build`,
output of `npx eslint .`, and (every 3rd task) confirm the 7 schema blocks
are still in my court to apply.

When you've finished §10.1 — STOP and let me test on a phone before you do
anything else.

---

## TL;DR for Lovable

I have a working, security-hardened Next.js 16 + Supabase + framer-motion
anonymous AI roleplay matchmaking platform. Your job is **frontend polish only**:
Lenis smooth scroll, framer-motion transitions, mobile-responsiveness, PWA,
rebrand, and wiring buttons to existing server actions for NOWPayments token
purchases + filling legal pages + wiring admin dashboard UI. **Never** touch
`proxy.ts`, `lib/actions/**`, `lib/utils/safety|moderation|turnstile|url.ts`,
`lib/ai/prompts|policy.ts`, `api/nowpayments/webhook/route.ts`. **Never** add
`'use server'` anywhere. **Never** move a `lib/utils/*` or
`lib/notifications/*` file into `lib/actions/`. Match the existing doc-comment
code style. After every change: `npm run build` + `npx tsc --noEmit` + `
npx eslint .` all exit 0. Read `LOVABLE.md`, `AGENTS.md`, `SETUP.md`,
`DEPLOY.md`, `To-Do.md`, `ISSUES.md` first. The `_bedrock` of the project is
done — you are adding the skin, not the skeleton.