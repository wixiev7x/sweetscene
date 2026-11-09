# Phase 3 — DESIGN Environment (Vercel + Supabase staging)

> Branch: `stripe-link` · Date: 2026-11-09 · DESIGN = staging. MAIN untouched (Phase 6 gated on "GO PRODUCTION").

## 1. Infrastructure created / brought up

| Piece | Result | Evidence |
|---|---|---|
| DESIGN Vercel project | **`sweetscene-design`** id `prj_M0lMNeWOlPjcerhyNGrfrPsySE77`, corruptnb account, team "sweet" (slug **sweet14**, id team_6UAkAbq9PEyj6z2jxQcawvEs) | [TESTED] POST /v11/projects (teamId must be QUERY param) |
| DESIGN Supabase project | **`ss design`** ref **rcgxcxygoatdmpxnvnbu** (Sydney) — was PAUSED since before Phase 0 → **ACTIVE_HEALTHY** via restore API | [TESTED] POST /v1/projects/{ref}/restore |
| Production deploy | **https://sweetscene-design.vercel.app** — dpl_5sUFukFMtoU84ATwe5rFXkySKiV5, state READY | [TESTED] vercel CLI deploy --prod + GET 200 |
| Custom domain | `design.sweetscene.love` ADDED to project (verified:false — pending DNS) | [TESTED] POST /v10/.../domains |

## 2. Database schema [TESTED]

- Applied **lib/supabase/schema.sql atomically** via management SQL endpoint
  (POST /v1/projects/{ref}/database/query — all-or-nothing transaction; any error = full rollback).
- Verified after apply: **27 tables**, 10 Phase-17 RPCs (ban_user_typed, unban_user_typed,
  user_is_shadowbanned, assert_current_user_mod, get_my_admin_role, get_effective_role,
  publish_character, admin_review_character, list_characters_pending_review,
  messages_participant_visible), characters status/triggers/limits/tagline columns,
  stripe_events + stripe_customers, bans type/appeal_state/moderator_id, **avatars bucket**
  (public, file_size_limit 2,097,152, mimes png/jpeg/webp/gif, 3 owner-folder policies).
- **All 3 migrations (stripe-billing, admin-moderation, character-creation) re-run on the
  live DESIGN DB → HTTP 201 ×3 = idempotent** [TESTED via /tmp/opencode/verify-migrations.mjs].
- **Source-fixes made during apply** (both committed):
  1. schema.sql ordering: "Participants can insert human messages" policy (uses
     `is_current_user_banned()`) moved AFTER the function's definition — pre-existing
     ordering bug blocked single-transaction fresh replays.
  2. Migration 01: unguarded `create policy "users can read own stripe profile"` → added
     `drop policy if exists` guard (42710 on re-run otherwise). Mirror in schema.sql too.

## 3. Dev data copy (runjhpkyqcdbiijrqmfl → rcgxcxygoatdmpxnvnbu)

| Table | Result |
|---|---|
| matches | **6/6 copied** [TESTED] |
| messages | **4/4 copied** [TESTED] (encrypted with .env.local's MESSAGE_ENCRYPTION_KEY — same key deployed to Vercel env) |
| profiles | **Impossible by design** — `profiles.id` FK → auth.users (23503); auth identities not REST-copyable. Old dev identities inert on DESIGN; users re-signup. (Column-filter also dropped 8 source-only cols: username, avatar_url, bio, age_* — known live-vs-repo divergence.) |

## 4. Vercel environment (11 vars, production+preview, encrypted) [TESTED]

NEXT_PUBLIC_SUPABASE_URL=https://rcgxcxygoatdmpxnvnbu.supabase.co · NEXT_PUBLIC_SUPABASE_ANON_KEY ·
SUPABASE_SERVICE_ROLE_KEY · NEXT_PUBLIC_SITE_URL=https://sweetscene-design.vercel.app (flip to
design.sweetscene.love once DNS live) · NEXT_PUBLIC_STAGING_BANNER=design · AI_PROVIDER ·
AI_API_KEY · DEEPSEEK_ENDPOINT · MESSAGE_ENCRYPTION_KEY · POLLINATIONS_API_URL.
NOT set (documented): STRIPE_* ([NEEDS ME] TEST account), TURNSTILE_*, UPSTASH_* (rate limiting
degrades gracefully), MODERATION_* (keyword floor only), GEMINI, AGE_VERIFICATION_*,
ERROR_WEBHOOK_URL/CANARY_TOKENS.

## 5. Storage + character lifecycle E2E on DESIGN — **22/22 PASS** [TESTED]

(/tmp/opencode/design-storage-e2e.mjs, real users ss-design-{admin,alice,bob}@test.local)

- Upload matrix: own-folder 200 · other-user folder blocked · anon blocked (hosted storage
  returns 400 wrapping {AccessDenied} — same as local) · wrong mime 400 · public read 200.
- Character lifecycle: REST insert with `status:"published"` → **forced draft by trigger** →
  publish_character no-avatar → **published** → other user sees → WITH avatar → owner PATCH
  avatar_url → publish → **pending_review** → other user blocked → **admin_review_character
  approved** → other user sees → **creator notified** (admin_message) → queue RPC denied for
  normal user → **cross-account update blocked** (prompt unchanged).
- **NOTED platform finding:** hosted storage-api does NOT enforce `file_size_limit` at upload
  time (3MB upload → 200; local stack DID reject). Bucket row verified configured
  (2,097,152 bytes). Mitigation: client-side 2 MB guard in handleUploadAvatar (app path
  protected). Not fixable from repo — flagged to Supabase platform behavior.

## 6. Secrets grep on deployed bundle — **ZERO findings** [TESTED]

All 13 first-load JS chunks downloaded from https://sweetscene-design.vercel.app:
service-role key 0 · MESSAGE_ENCRYPTION_KEY 0 · sk_test/sk_live 0 · whsec_ 0 · sbp_ 0 ·
"service_role" literal 0. Anon key present in 1 chunk (public by design, NEXT_PUBLIC_).

## 7. Smoke on DESIGN [TESTED]

`/` 200 · `/privacy` 200 **+ banner "DESIGN — Staging environment · not production · data
here is for testing only"** · `/signup` 200 · `/login` 200 · `/billing` 200 with "Coming
soon" ×5 (STRIPE_LINK_* unset — expected) · `/store` 200 · `/create-character` 307 (auth
redirect, correct) · `/api/health` 200 `{"status":"ok","supabase":"reachable","http":401}`
(identical shape to MAIN) · POST /api/webhooks/stripe unsigned → **503 `{"error":"Not
configured"}`** — correct fail-closed while STRIPE_WEBHOOK_SECRET unset (400 path verified
locally in Phase 2).

## 8. [NEEDS ME]

1. **DNS at Namecheap** (no API access from here; zone sweetscene.love is at Namecheap, not
   Cloudflare). Add these records, then I verify via DoH/curl:
   1. Host: `_vercel` · Type: **TXT** · Value: `vc-domain-verify=design.sweetscene.love,c27b3b4525bf620ba8ff`
      (Vercel requires apex-ownership proof because sweetscene.love apex is claimed by the
      MAIN account — different account from DESIGN.)
   2. Host: `design` · Type: **CNAME** · Value: `cname.vercel-dns.com`
   3. After DNS: I re-check verification via Vercel API + curl design.sweetscene.love → 200,
      then flip NEXT_PUBLIC_SITE_URL to https://design.sweetscene.love and redeploy.
2. **Stripe TEST configuration** (blocks live /billing + webhook E2E T1–T6): create TEST
   products/prices matching lib/billing/constants.ts exactly (VIP monthly $9.99/30d recurring,
   VIP yearly $99.99/365d, starter $4.99, standard $19.99, whale $34.99), 5 Payment Links →
   STRIPE_LINK_* env, webhook endpoint https://sweetscene-design.vercel.app/api/webhooks/stripe
   (or design.sweetscene.love after DNS) → STRIPE_WEBHOOK_SECRET, restricted sk_test_ key,
   enable customer portal (return /billing).
3. **Optional envs** when available: TURNSTILE_*, UPSTASH_*, MODERATION_*, AGE_VERIFICATION_*.

## 9. Git state notes

- `.gitignore` gained `.env*` (vercel CLI edit; `.env.example` already tracked — unaffected).
- vercel CLI added a dev-scoped VERCEL_OIDC_TOKEN line to local `.env.local` (untracked,
  expires ~12h, harmless).
- Repo commits this phase: app/layout.tsx (staging banner), .env.example, deploy-guide/env-manifest.md §11,
  lib/supabase/schema.sql (ordering + policy-guard fixes), supabase/migrations/2026-11-06-01 (guard),
  .gitignore, this report.
