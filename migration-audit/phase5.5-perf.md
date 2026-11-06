# Phase 5.5 — Performance Pass (user-added scope)

> User request: "also fix all the other issues like slow laoding of webiste and stuff."
> Branch: `stripe-link` · Date: 2026-11-06 · All changes local; DESIGN/MAIN deploys unaffected until Phase 3/6.

## 1. Baseline diagnosis [TESTED]

Evidence: `.next/diagnostics/route-bundle-stats.json` from a production build (Next 16.2.9).

- **Every one of the 52 routes shipped ~805–984 KB of first-load JavaScript.** The floor —
  even for logged-out static pages like `/privacy`, `/terms`, `/_not-found` — was ~805 KB.
  Heaviest: `/chat/[id]` 984 KB, `/lobby` 969 KB, `/matchmake` 850 KB, `/play/[id]` 847 KB.
- **Root cause #1 — supabase-js on every route [TESTED]:** `components/ui/SiteNav.tsx`
  (rendered by the root layout on every page) top-level-imported `createClient` from
  `@/lib/supabase/client`. The shared supabase-js chunk (`1-_cfjq3ea25w.js`, 238 KB +
  realtime deps) was present in the firstLoadChunkPaths of **all 52 routes** — including
  pages that never touch auth (legal, marketing, logged-out landing).
- **Root cause #2 — framer-motion on /chat:** `components/FadeToBlack.tsx` imported
  framer-motion (~124 KB chunk) for three one-shot entrance animations.
- Framework floor (not fixable, not a problem): react-dom 222 KB + Next runtime ~108 KB.
- Dependency audit: lean — no icon/markdown/chart libraries; only @supabase/*, @upstash/*,
  framer-motion, next, react, sonner, server-only.
- Nav links were already `prefetch={false}`; fonts already via `next/font`; HeartCursor /
  ScrollProgress already rAF + direct-style (no layout thrash).

## 2. Fixes applied

### 2.1 SiteNav split — supabase-js no longer on the critical path of logged-out pages
- **NEW `components/ui/NavSession.tsx`** — headless client component doing everything the
  nav previously needed the library for: session fetch, token balance, notification list,
  realtime notification channel. It returns `null` and reports back via callbacks.
- **`components/ui/SiteNav.tsx`** now:
  - detects a session cookie WITHOUT any library (`sb-*-auth-token` regex over
    `document.cookie`; the cookie is `httpOnly:false` by design in `lib/supabase/server.ts`,
    so this is a read, not a security change);
  - renders `<NavSession>` via `next/dynamic` **only when a session cookie exists**;
  - keeps all UI identical (bell dropdown, sidebar, mobile tabs), plus the 3 old
    `/checkout?item=…` links now point directly at `/billing` (kills the Phase-1 redirect hop).
- Result: anonymous visitors (landing/legal/marketing traffic) never download supabase-js;
  signed-in users load it asynchronously after first paint, without blocking navigation.

### 2.2 FadeToBlack — framer-motion removed (CSS keyframes instead)
- Three entrance animations (vibe-check slide, 2s fade, content rise) reimplemented with
  plain CSS `animation` + `@keyframes`. Exit animation on the vibe-check screen was dropped
  (polish loss, acceptable).
- **Pre-existing bug found + fixed:** a stray `}` after `@keyframes slowSpin` made BOTH
  `slowSpin` and `glowExpand` invalid CSS — the ⏳ spinner and celebration-glow animations
  had silently never run. Now valid.

### 2.3 Chat page N+1 fix [READ]
- `app/chat/[id]/page.tsx` fetched character names/avatars with one `.single()` select per
  character id (up to 3 sequential round-trips per chat load). Replaced with a single
  `.in("id", …)` query; original first-avatar-wins ordering preserved by iterating
  `m.character_ids` over the result map.

### 2.4 Stale legacy copy sweep [TESTED grep]
- `app/store/layout.tsx` meta description: "crypto checkout, no card" → "pay by card,
  checkout on Stripe".
- `app/privacy/page.tsx` ×2: "our crypto payment processor" → "our card payment processor".
- (All other `crypto` matches are `crypto.randomUUID()` / `lib/utils/crypto` — unrelated.)

## 3. Results [TESTED — same diagnostics file after the changes]

| Metric | Before | After | Δ |
|---|---|---|---|
| First-load JS floor (logged-out pages) | 805 KB | **570 KB** | **−235 KB (−29%)** |
| `/privacy`, `/terms`, `/_not-found` | 805 KB | 570 KB each | −235 KB |
| `/chat/[id]` | 984 KB | **866 KB** | −118 KB |
| `/billing` | ~810 KB | 577 KB | −233 KB |
| supabase chunk in logged-out first-load | yes (all 52 routes) | **no** (verified absent from `/privacy` firstLoadChunkPaths; still first-load on authed app pages that use the client directly — correct) | lazy for nav only |
| framer-motion | on /chat first-load | gone from /chat (pure CSS now) | −124 KB |

- `npx tsc --noEmit` clean; `npm test` **34/34**; `npm run build` success (see §5 evidence).
- Local smoke [TESTED]: `/`, `/privacy`, `/store`, `/billing` → 200; `/create-character` →
  307 (auth redirect, correct); nav renders on /privacy (Community/Confessions/Upgrade/
  SweetScene present in HTML); no `/checkout` links remain in rendered HTML.

## 4. Deliberately deferred (documented, not forgotten)

| Item | Why deferred |
|---|---|
| `/lobby` still uses framer-motion (972 KB route) | Single page; replacing AnimatePresence-driven sequences risks visual regressions; revisit with a browser/Lighthouse session. |
| `<img>` → `next/image` for avatars | Avatar URLs are user-supplied (Storage/Pollinations/Unsplash). next/image needs remotePatterns + optimizer config and can break user URLs; current `<img>` usage is deliberate and CLS-safe (fixed-size rounded boxes). |
| Service-worker cache tuning (`public/sw.js`) | Vercel already serves `/_next/static` immutable + CDN-cached; SW adds little for first-load JS and risks staleness bugs. |
| Fonts/assets | Already optimal (`next/font`, no external font requests). |

## 5. Verification evidence

- Bundle stats: `node -e` over `.next/diagnostics/route-bundle-stats.json` (before/after
  outputs preserved in this report; rerun any time with a fresh build).
- Build log: `/tmp/opencode/perf-final-build.log` (final build incl. copy + N+1 fixes).
- Tests: `npm test` → 34/34. Types: `npx tsc --noEmit` → clean.

## 6. [NEEDS ME]

1. **Real-world measurement:** run Lighthouse (Chrome DevTools → Lighthouse → Mobile +
   Desktop) against the DESIGN deploy once Phase 3 stands it up, esp. /lobby and /chat —
   no browser available in this environment, so field numbers (LCP/TBT/CLS) are untested
   here. Record results in Phase 7's final sweep.

## 7. Files changed (this phase)

- NEW `components/ui/NavSession.tsx`
- M `components/ui/SiteNav.tsx`
- M `components/FadeToBlack.tsx`
- M `app/chat/[id]/page.tsx` (N+1 fix + Phase 5 report-category button earlier)
- M `app/store/layout.tsx`, M `app/privacy/page.tsx` (legacy copy)
