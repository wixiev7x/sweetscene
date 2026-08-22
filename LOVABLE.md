# Design handoff

For redesigning this app in Lovable, v0, Cursor, or any other design tool.

Read the **Do not touch** section before making changes. This codebase has
security boundaries that are invisible in the file tree — four real
vulnerabilities in its history came from correct-looking code sitting in the
wrong file. A tool that reorganises files without that context will
reintroduce them.

---

## What this app is

A 16+ AI roleplay matchmaking platform. Two people are matched into a scene
hosted by an AI character. Users create characters, chat 1:1 with them, DM
each other after a mutual reveal, and buy tokens to spend on turns.

Content has two ratings. **SFW is the floor and the default.** NSFW is gated
to accounts verified as adult (`age_cohort = 'adult'`), never to the 16+
platform minimum. That gate is not a styling concern and must not be moved
into the UI layer.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 ·
Supabase (Postgres + RLS + Auth) · DeepSeek for chat.

> Next.js 16 is not the Next.js in most training data. Middleware is
> `proxy.ts` with an exported `proxy()` function, not `middleware.ts`.
> `next lint` no longer exists — the script is `eslint`. Check
> `node_modules/next/dist/docs/` before writing framework code.

---

## Start here

**`/style-guide`** renders every design token and every UI component on one
page. It reads no data and calls no server action, so it is safe to restyle
freely and it is the fastest way to see a change land.

Run it:

```bash
npm run dev     # then open http://localhost:3000/style-guide
```

---

## Tokens

All colour lives in `app/globals.css`. Change a value there and it retints
the whole app — that is the point of the layer, and it is the file a design
tool should edit first.

### Brand — start here

Every glow, ring, gradient, and active state in the app derives from these
six values. Changing `--brand` alone rebrands the product.

| Token | Utility | Use |
|---|---|---|
| `--brand` | `bg-brand` | Primary brand — rings, glows, borders |
| `--brand-light` | `text-brand-light` | Brand text |
| `--brand-lighter` | `text-brand-lighter` | Brand text, emphasis |
| `--brand-dark` | `to-brand-dark` | Gradient end |
| `--brand-deep` | `bg-brand-deep` | Deep background wash |
| `--brand-deepest` | `bg-brand-deepest` | Deepest background wash |

Tailwind's alpha syntax works on all of them — `bg-brand/10`,
`border-brand/30`, `ring-brand/50` — so a hue change retints the tinted
surfaces along with the solid ones.

### Surfaces and lines

| Token | Utility | Use |
|---|---|---|
| `--background` | `bg-background` | Page background |
| `--surface` | `bg-surface` | Cards, panels |
| `--surface-raised` | `bg-surface-raised` | Hover states, chips |
| `--surface-sunken` | `bg-surface-sunken` | Inset fields, wells |
| `--line` | `border-line` | Default card border |
| `--line-strong` | `border-line-strong` | Hover border |
| `--line-focus` | `border-line-focus` | Focused input border |

### Text

Five steps of emphasis, brightest to faintest.

| Token | Utility | Use |
|---|---|---|
| `--foreground` | `text-foreground` | Primary text |
| `--foreground-dim` | `text-foreground-dim` | Primary on hover |
| `--muted-strong` | `text-muted-strong` | Secondary text |
| `--muted` | `text-muted` | Captions, placeholders |
| `--muted-faint` | `text-muted-faint` | Disabled, watermarks |

### Semantic accents

| Token | Utility | Use |
|---|---|---|
| `--accent` | `bg-accent` | Primary action |
| `--danger` | `text-danger` | Bans, deletes, errors |
| `--warning` | `text-warning` | VIP, caution |
| `--success` | `text-success` | Confirmations |
| `--info` | `text-info` | Neutral highlights |
| `--restricted` | `text-restricted` | Temporary restriction |

Accents are **semantic, not decorative**. Pick `--danger` because the action
destroys something, not because red looks right. A retheme that swaps the
hues then keeps working.

Raw values sit on `:root` and are mapped to Tailwind through `@theme inline`,
so they can also be overridden at runtime for a theme switcher.

### Migration state

The whole app has been converted — **676 raw colour classes across 33 files**
became tokens, and no `neutral-*`, `gray-*`, or `purple-*` class remains in
`app/` or `components/`. There is nothing left to migrate; new code should use
tokens from the tables above.

Two things worth knowing about that conversion:

- **Purple mapped exactly.** `purple-500` → `brand`, `purple-400` →
  `brand-light`, and so on. Visually a no-op.
- **Two grey scales were unified.** Admin pages used `neutral-*` (pure grey)
  and user-facing pages used `gray-*` (slightly blue-tinted). They are now one
  scale on the neutral values. The difference was a few percent of hue at the
  same lightness — imperceptible on a dark background, and it was drift rather
  than intent — but it is a real change, so it is called out rather than
  buried.

There is one deliberate exception: `bg-white/5` and `border-white/10` are
still used for the glassmorphic panels in the user-facing pages. Those are
alpha overlays on whatever sits behind them, so they already follow a retheme
correctly and do not need a token.

---

## Components

`components/ui/`, all re-exported from `components/ui/index.ts`. Import from
the barrel: `import { Button, Badge } from "@/components/ui";`

| Component | Props |
|---|---|
| `Button` | `variant` primary·accent·danger·ghost, `size` sm·md·lg, `loading`, + native button props |
| `Badge` | `tone` nsfw·sfw·visibility·tier·personality·tag·vip·admin·banned |
| `Avatar` | `src`, `name` (required — drives the initial fallback), `size` xs–xl, `shape` circle·square |
| `TextField` / `TextArea` | all native input / textarea props |
| `Modal` | `open`, `onClose`, `maxWidth` (Tailwind class); closes on Escape and backdrop |
| `Spinner` / `LoadingState` | `size` sm·md·lg; `LoadingState` adds `text` |
| `Skeleton` | `variant` line·card·avatar·circle |
| `ProgressBar` | `value`, `max`, `widthClass`; clamped to 0–100% |
| `EmptyState` | `title`, `subtitle`, `icon` |
| `TypingDots` | `size` sm·md |
| `SiteNav` | app-wide navigation |

Adding a component here? Add it to `/style-guide` too, or it is invisible to
the next person doing a redesign.

Feature components in `components/` (`ChatBox`, `MessageList`,
`NotificationBell`, `FadeToBlack`, `AgeCohortGate`, `TurnstileWidget`) are
presentational and safe to restyle — with two exceptions noted below.

---

## Routes

| Route | Auth | Notes |
|---|---|---|
| `/` | public | Landing |
| `/login` | public | OAuth + Turnstile captcha |
| `/legal/terms`, `/legal/privacy` | public | |
| `/style-guide` | public | Design surface — no data |
| `/lobby` | required | Matchmaking entry |
| `/characters`, `/characters/[id]`, `/characters/my` | required | Browse / detail / owned |
| `/characters/[id]/edit` | required | Creator-only; the server re-checks ownership |
| `/create-character` | required | |
| `/chat/[id]` | required | **Matched scene** — two humans plus an AI narrator |
| `/play/[id]` | required | **Solo character play** — one human, one AI |
| `/dm/[id]` | required | User-to-user DM, post-reveal |
| `/profile` | required | |
| `/admin`, `/admin/users`, `/admin/characters`, `/admin/reports`, `/admin/settings` | admin | |

Auth gating is by prefix in `PROTECTED_PREFIXES` in `proxy.ts`. **Adding a new
authenticated route means adding its prefix there** — a new route is public
until you do, and the page's own auth check is the only thing standing in
front of it.

---

## Do not touch

Everything below is a security boundary. Restyling is fine anywhere; these
files are about *where code lives*, and moving code between them is what
breaks things.

### The one rule that matters most

**`"use server"` at the top of a file makes every export in it a public HTTP
endpoint** — callable by anyone, authenticated or not, with arguments they
control. It marks a trust boundary, not a location.

Four vulnerabilities in this codebase came from exactly that:

- Notification writers exported from a `"use server"` file — anyone could
  write arbitrary text into any user's notification feed. They now live in
  `lib/notifications/dispatch.ts`, which deliberately has **no** `"use server"`.
- `verifyTurnstile` exported the same way — a free oracle spending the
  platform's captcha secret. Now `lib/utils/turnstile.ts`.
- A dead no-op stub published as an endpoint for no benefit.
- An internal helper reachable without the auth check its callers performed.

So: **never move a function into a `"use server"` file to "co-locate" it**, and
never add `"use server"` to a file to make an import work. If a helper is
called only by other server code, it must live outside `lib/actions/`.

### Files

| File | Why |
|---|---|
| `proxy.ts` | CSP, HSTS, auth gating. `frame-src` allows the Turnstile iframe — remove it and login breaks. |
| `lib/actions/*` | Every export is a public endpoint. Each re-derives the caller's identity from the session; do not add a `userId` parameter — it arrives off the wire. |
| `lib/notifications/dispatch.ts` | Internal writers, deliberately outside the action boundary. |
| `lib/utils/turnstile.ts` | Captcha verification, unauthenticated by necessity. |
| `lib/ai/prompts.ts` | Fences untrusted character text between `CHARACTER_BRIEF` markers. Reordering the concatenation breaks the fence. |
| `lib/ai/policy.ts` | The global content policy every character is built on. |
| `lib/utils/safety.ts` | PII redaction, injection scrubbing, blocked terms. Matching runs against a normalised form — do not "simplify" it back to a substring test. |
| `lib/utils/moderation.ts` | Classifier layer. Screens prompts, messages, and the model's own output. |
| `lib/utils/url.ts` | Avatar URL allowlist. |
| `lib/supabase/schema.sql` | RLS policies and CHECK constraints. |
| `lib/config/settings.ts` | Runtime secret resolution. |
| `app/api/nowpayments/webhook/route.ts` | Payment IPN — signature-verified. |

### Two components that look presentational but are not

- **`AgeCohortGate`** enforces the 18+ NSFW gate. Restyle it; do not change
  when it renders or what it checks.
- **`TurnstileWidget`** is the login captcha. Its container can be styled;
  the widget must keep rendering, and the CSP entry in `proxy.ts` must stay.

### Also

- **Never hardcode a key, URL, or model name.** Secrets resolve at runtime
  from the `platform_settings` table with an env fallback
  (`lib/config/settings.ts`), manageable from `/admin/settings`. A design
  tool inlining a value it saw in an example is a real failure mode here.
- Adding an external image host means adding it to *both* `img-src` in
  `proxy.ts` **and** the allowlist in `lib/utils/url.ts`, plus the
  `is_safe_avatar_url` SQL function. Miss one and images silently break or a
  validation gap opens.

---

## Working safely

Good first tasks, in rough order of risk:

1. Rebrand by editing `--brand` in `app/globals.css`. One value, whole app.
2. Retheme the greys by editing the surface / line / text tokens.
3. Restyle a component in `components/ui/` — the change propagates everywhere.
4. Lay out a page differently, keeping its data flow intact.

After any change:

```bash
npx tsc --noEmit    # must be clean
npx eslint .        # must be clean — note: NOT `next lint`, removed in 16
npm run build
```

If a design tool proposes moving files between `lib/actions/`,
`lib/notifications/`, and `lib/utils/`, or adding `"use server"` anywhere —
reject it. That refactor is never a design change.

---

## Related docs

- **`SETUP.md`** — Supabase, Vercel, env vars, admin bootstrap, deploy checklist
- **`.env.example`** — every variable, with the four that are env-only marked
- **`AGENTS.md`** — the Next.js 16 warning
