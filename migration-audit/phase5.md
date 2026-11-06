# Phase 5 — Character Creation (DESIGN) · 2026-11-06

**Branch:** `stripe-link` (lineage: b062986 → 86562c8 P1 → bf18349 P2 → 5b922a6 P4 → this commit)
**Scope:** character builder with review workflow, Supabase Storage avatars, admin review queue, triggers/limits in the matching pipeline, impersonation validation.

---

## 1. What was built

### Schema — `supabase/migrations/2026-11-06-03-character-creation.sql` (§1–§11, mirrored as "Phase 18" in `lib/supabase/schema.sql`)
| Piece | Detail |
|---|---|
| `characters` columns | `tagline TEXT`, `triggers TEXT[] '{}'`, `limits TEXT[] '{}'`, `status` (draft/pending_review/published/rejected, default `draft` for new rows; live rows backfilled `published`) + CHECK + partial index |
| `match_characters_snapshot` | same three columns — the matching pipeline READS triggers/limits (§4 extends `populate_match_snapshot`) |
| `owner_id` mapping | spec's `owner_id` = existing `creator_id` (staging-compat; no destructive rename) |
| Dual axes | `visibility` (private/unlisted/public — listing axis) stays; `status` is the NEW review axis |
| Status integrity (§5) | **BEFORE INSERT** trigger forces non-staff inserts to `draft` (kills insert-as-published bypass; service/postgres seeding keeps provided status). **BEFORE UPDATE OF status,avatar_url** trigger: avatar swap on published (non-staff) auto-demotes to `pending_review`; staff transitions unrestricted; owner → published requires OLD in (draft,published) AND no avatar AND OLD ≠ rejected; demotions always allowed. Both triggers `SECURITY DEFINER` (see §3 bug) |
| `publish_character` (§6) | creator-only (+ban check); rejected → `draft` (honest edit-then-resubmit path); avatar ⇒ `pending_review`, else `published`; staff override branch |
| `admin_review_character` (§7) | mod-guard; only pending_review rows; approve/reject → published/rejected; audit `approved_character`/`rejected_character` + notification to creator (admin_message) |
| `list_characters_pending_review` (§8) | mod-guard queue, oldest first, creator display name |
| Storage (§9) | `avatars` bucket public-read, 2 MB limit, png/jpeg/webp/gif allowlist; owner-folder INSERT/DELETE policies (`foldername[1]=auth.uid()`) |
| `is_safe_avatar_url` (§11) | + loopback-http branch for LOCAL-STACK uploads only (`http://(localhost|127.0.0.1):…/storage/v1/`); prod stays https-only |

### App code
- `lib/actions/characters.ts` — `tagline/triggers/limits/publish` params; caps (tagline 120, 10 items, trigger 120, limit 160 chars); **REAL_PERSON_BLOCKLIST (~120 curated names**, exact-normalized match) enforced in `createCharacter`; new fields screened by `moderateFields` (they land in system context); `publishMyCharacter`; status resets on authored edits / avatar change; `PUBLIC_COLUMNS` + status.
- `lib/actions/admin.ts` — `listPendingCharacters`, `adminReviewCharacter` (mod-tier).
- `lib/actions/ai_wrapper.ts` — chat + solo flows SELECT triggers/limits and append `behaviouralDirective()` (platform safety overrides character behaviour — stated in-prompt).
- `lib/utils/url.ts` — `validateAvatarUrl` allows loopback http only when the env Supabase URL itself is loopback (local dev uploads; prod unaffected).
- UI: `create-character` (tagline/triggers/limits fields, **avatar UPLOAD to Storage** + AI-generate kept, Publish vs Save-Draft buttons, status-aware success copy), `characters/[id]/edit` (status chip + Publish + new fields), `characters/my` (status badges + Publish button + rejected hint), admin `characters` page (**Review Queue** with approve/reject + note), audit-log filters + impersonation report category in chat.

## 2. Verification [TESTED — local supabase stack]

| # | Assertion | Result |
|---|---|---|
| a | REST insert with `status:'published'` in payload → forced `draft` | ✅ |
| b | `publish_character` no avatar → `published`; other user CAN select | ✅ |
| c | avatar char → `pending_review`; other user CANNOT see; creator CAN; approve → other user CAN | ✅ |
| d | reject → hidden from others, visible to creator; creator demotes to draft, clears avatar, republish → `published`, visible | ✅ |
| e | cross-account UPDATE and DELETE (other user on creator's row) → RLS-blocked, row survives | ✅ |
| f | celebrity-name REST insert NOT blocked at DB level (documented limitation) but stays draft → unlisted to others | ✅ (honest) |
| g | Storage: own-folder upload ✅ · other-user folder blocked ✅ · anon blocked ✅ · public read ✅ · >2 MB rejected ✅ · wrong mime rejected ✅ | ✅ |
| h | match snapshot carries tagline/triggers/limits | ✅ |
| i | audit rows `approved_character`/`rejected_character` + `admin_message` notification to creator | ✅ |
| j | `list_characters_pending_review`: normal user denied; moderator gets rows | ✅ |
| k | avatar swap on published → auto-demote `pending_review` | ✅ |

**`/tmp/opencode/char-e2e.mjs` → 35/35 PASS, 0 FAIL** (real REST/auth calls; real users ss-e2e-{admin,mod,alice,bob}@test.local — created via auth admin API; cleanup deletes created rows/objects at end of every run).
Also: migration re-run = **0 errors** (idempotent) · `npx tsc --noEmit` clean · `npm run build` success · `npm test` 34/34.

## 3. Bugs found & fixed during this phase

1. **[PRE-EXISTING LEAK — FIXED §3b]** The A5 "Age-gated character viewing" SELECT policy granted `is_public OR visibility='unlisted'` **without any status check** — permissive RLS policies OR together, so it overrode the new status-gated policy: every signed-in user could SELECT pending_review/rejected characters [TESTED: bob saw a pending char]. Fixed: non-owner branches now require `status='published'`.
2. **[NEW-CODE BUG — FIXED]** The status-guard triggers ran in invoker context; `get_effective_role` is EXECUTE-revoked for authenticated/anon → every user INSERT into characters failed 42501 [TESTED]. Fixed: both trigger functions `SECURITY DEFINER SET search_path = public, pg_temp`.
3. **[PORTABILITY]** `profiles.username` exists on the live/staging DB but NOT in the repo base schema (fresh local replay) → `COALESCE(p.anonymous_username, p.username, …)` broke locally. Fixed to portable `COALESCE(p.anonymous_username, 'user ' || left(p.id::text, 8))`. Same divergence family as Phase 4 (staging DB is newer than repo schema.sql).

## 4. Deliberate decisions / documented deviations

- **owner_id = creator_id** (no rename; staging-compat).
- **status vs visibility:** two orthogonal axes (listing vs review) — both enforced at RLS/trigger level.
- **Avatar ⇒ review, no-avatar ⇒ live** (review exists to protect the *image* surface; text was already screened by `moderateFields` + platform prompt wrapping).
- **Rejected → draft → republish** (no direct rejected→published by owner; edit cycle is enforced).
- **Impersonation validation is TS-layer only** (curated ~120-name blocklist, exact-normalized match + moderation classifier + "Impersonating a real person" report reason). A curated list cannot be exhaustively matched in SQL; direct REST inserts with celebrity names succeed but stay `draft` (invisible to others) until reviewed/published — publish with avatar goes through review. **Residual risk documented:** a user could publish a no-avatar celebrity-named character without review; mitigations = report reason + moderation queue + admin rename/delete.
- **`populate_match_snapshot` is service-role** in the app (matchmaking.ts admin client) — E2E matches that call shape.
- **Storage avatar URL validation** (TS `validateAvatarUrl` + DB `is_safe_avatar_url`) allow loopback http ONLY when the deployed Supabase URL itself is loopback (local dev). Prod stays https + host-allowlisted.

## 5. `[NEEDS ME]`

1. **Apply the migration to the DESIGN DB** — no DDL path with current credentials (SQL editor paste, or an sbp token for the live-projects account, or the fresh-project route). Then `NOTIFY pgrst, 'reload schema';`. Order: base schema (fresh project) or directly (existing staging — all statements are `IF NOT EXISTS`/`OR REPLACE`).
2. **Verify the `avatars` bucket** exists with the intended limits in the Supabase Studio storage UI after the migration runs (the SQL creates it idempotently).
3. Impersonation blocklist is curated — review/extend the list over time (it is a plain TS array, easy to grow).
