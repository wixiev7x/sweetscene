# Phase 4 — Admin Panel & Moderation (DESIGN-first)

Branch: `stripe-link` (lineage: b062986 → 86562c8 Phase 1 → bf18349 Phase 2 → this commit)
Status: code complete, verified against a full **local Supabase stack** (E2E 59/59 API + 14/14 page-level, migration idempotent). Not yet applied to DESIGN cloud DB (no DDL path — see [NEEDS ME]).

---

## 1. Decision record

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Admin surface = main app `app/admin`** | Merged lineage (admin-panel + admin-2fa-panel), richest UI (users/reports/moderation/audit/characters/settings), deployed on the MAIN Vercel project. The root `admin/` subproject ("sweetscene-admin", TOTP 2FA, divergent model: `profiles.role user\|moderator\|super_admin`, `app_settings`, `audit_logs`, `bans.moderator_id`, reports `target_type/target_id`) is **left untouched**; retire-or-keep is deferred to the user (it keeps working against the same DB). |
| 2 | `admin_audit_log` **is** the append-only `mod_actions` table | Already DB-enforced (REVOKE INSERT/UPDATE/DELETE from authenticated/anon; writes only inside SECURITY DEFINER RPCs). Instead of a new table, the coverage gaps were fixed (grant_tokens, resolve_report, set_character_flag, deleted_character, warned_user now audited). |
| 3 | Role model: `profiles.role` = `user\|moderator\|admin` | Staging's existing `super_admin` maps to `admin` via `get_effective_role()`; `is_admin` boolean stays source of truth and is backfilled into `role`. Moderator tier = reports inbox + moderation queue + warn **only**; users/characters/audit-log/settings = admin-only (per-section server layouts + action guards). All ban/unban = admin-only. |
| 4 | Typed bans: `bans.type` = `temp\|permanent\|shadow` + `appeal_state` (`none\|pending\|granted\|denied`) + `moderator_id` (staging-compatible, supersedes legacy `banned_by` — legacy column kept but made nullable) | Reason is **mandatory at the DB level** in `ban_user_typed`/`unban_user_typed` (legacy `ban_user_with_reason`/`unban_user_with_reason` remain as thin delegates so any old caller keeps working). |
| 5 | Shadow semantics | **bans row only** — no profile flag, no sign-out, no notification. Enforcement: messages SELECT RLS policy (via `messages_participant_visible()` SECURITY DEFINER wrapper — hides the shadowbanned user's messages from other participants **retroactively**, own messages stay visible to them) + `claim_match` guard §14 (never matched with new users → eternal "waiting for a partner"). `user_is_shadowbanned()` is internal (no EXECUTE for authenticated → zero state leak; the policy wrapper returns "visible" when probed with someone else's uid). |
| 6 | Session revocation | `ban_user_typed` (hard types only) does `DELETE FROM auth.sessions WHERE user_id = …` **inside the RPC**. Verified on local stack: refresh grant → 400, existing access token → 403 (this GoTrue validates access tokens against `auth.sessions`) → effectively **instant**. `token_version` column added and incremented on every hard ban (recorded state for future claim-based revocation). No per-user admin API exists on this GoTrue version (all candidate endpoints 404). |
| 7 | `reports.target_user_id` = the other match participant | Set by `report_conversation`; `list_reports` returns `target_username`. Status vocabulary stays `open\|resolved\|dismissed` — **`resolved` == spec's `actioned`** (documented mapping; changing the live CHECK would be a destructive ALTER). |
| 8 | "Delete message" one-click **skipped** | `report_conversation`'s evidence snapshot stores no message IDs (sender_type/sender_id/content/created_at only); `resolve_moderation_item('message')` needs a message UUID; deleting a whole match's messages would over-delete. One-click **Warn** / **Restrict 7d** (admin) / Resolve / Dismiss delivered instead; message deletion remains available via the moderation queue for flagged content. |
| 9 | `/banned` wiring | `proxy.ts` now checks `is_current_user_banned` on protected pages (fail-open on RPC error — actions/RLS still fail closed) → 302 `/banned`. Ban RPCs write `ban_reason`/`banned_at` (columns added IF NOT EXISTS). Journey: ban → sessions revoked → user re-signs-in (auth allows; the ban lives on `profiles`) → proxy redirect → `/banned` renders reason + duration. Shadow bans deliberately never redirect (must look normal). |

## 2. What was built

**Migration `supabase/migrations/2026-11-06-02-admin-moderation.sql`** (idempotent, additive, staging-compatible; mirrored into `lib/supabase/schema.sql` Phase 17 block):
- §1 profiles: `role`, `token_version`, `ban_reason`, `banned_at` (all IF NOT EXISTS) + role backfill from `is_admin`.
- §2 `get_effective_role()` (internal), `assert_current_user_mod()` (scalar bool, granted), `get_my_admin_role()`.
- §3 bans: `moderator_id`, `banned_at`, `type` (backfilled temp/permanent from `expires_at`, CHECK temp|permanent|shadow), `appeal_state` default 'none'; legacy `banned_by` made nullable.
- §4 `user_is_shadowbanned()` (internal only).
- §5 messages SELECT policy + `messages_participant_visible()` wrapper (probe-shielded).
- §6 reports: `target_user_id` FK; `report_conversation` sets it; `list_reports` (+target_username, mod-guard); `resolve_report` (+audit 'resolved_report', raises on not-found, mod-guard).
- §7 `ban_user_typed` / `unban_user_typed` (+session DELETE, +token_version++, +audit; reason mandatory; self/staff/permanent/future-expiry guards) — legacy with-reason RPCs delegate.
- §8 `list_ban_history` (+type/appeal_state/moderator_id).
- §9 `list_admin_users` (+effective role, +is_shadowbanned).
- §10 `admin_grant_tokens` / `admin_set_character_flag` / `admin_delete_character` now audited.
- §11 `list_moderation_queue` / `resolve_moderation_item` → mod-guard.
- §12 `get_admin_stats_v2` + `signups_today`, `dau_last_24h` (auth.users.last_sign_in_at), `oldest_open_report_hours`.
- §14 `claim_match` shadow guards (both sides).
- §15 `send_human_message` DB-layer ban guard (fixes pre-existing gap — see §4 below).
- §16 `GRANT EXECUTE send_human_message TO authenticated` (fixes pre-existing grant hole).
- §17 `list_audit_log` accepts 'all' (fixes pre-existing empty-view bug).
- All new/internal fns REVOKE EXECUTE FROM PUBLIC; DROP-guard pattern for the 5 return-type/param-default replaces.

**App code**:
- `lib/actions/admin.ts`: `assertModerator`; moderator-tier guards on reports/moderation actions; `banUserTyped` (typed RPC, no client-side signOut — revocation is RPC-level); `unbanUserWithReason` → typed RPC; `getMyAdminRole`; `warnUser` (notification + audit 'warned_user'); legacy unused `banUser`/`unbanUser` deleted; types extended (role/is_shadowbanned/target_user_id/target_username/stats fields/ban history shape).
- `lib/notifications/dispatch.ts`: `notifyAdminMessage` (type `admin_message` — existed in the CHECK constraint but was never emitted).
- `app/admin/(dashboard)/layout.tsx`: gate = mod-or-admin (`assert_current_user_mod`), nav filtered by role (moderator sees Dashboard/Reports/Moderation only).
- NEW admin-only per-section server layouts: `users/`, `characters/`, `audit-log/`, `settings/` (`assert_current_user_admin`).
- `users/page.tsx`: typed ban form (temp 7d / temp 30d / permanent / shadow + shadow explainer), Moderator + Shadow badges, staff-aware button disables, ban history with type/appeal chips.
- `reports/page.tsx`: reported-user line + "View conversation" link; one-click Warn (textarea) / Restrict 7d (admin-only, reason) / Resolve / Dismiss; role chip.
- `page.tsx` (dashboard): 3 new stat cards (Signups Today, Active Today/DAU, Oldest Open Report).
- `audit-log/page.tsx`: real action filters (incl. new audit types; removed phantom filters that matched nothing).
- `lib/actions/auth.ts`: `signInAsAdmin` admits moderators ("staff") via `assert_current_user_mod`.
- `proxy.ts`: banned-redirect on protected pages (edge-safe client, fail-open on RPC error).
- `lib/actions/reports.ts`: deleted (dead code — inserted columns that only exist on staging; zero imports).
- `lib/supabase/server.ts`: cookie set/remove wrapped in try/catch (fixes 500 on read-only Server Component contexts — pre-existing prod bug).

**Deliberate non-change**: shadow enforcement is *fully DB-level* (`claim_match` §14 guards both directions + messages SELECT policy). No TS-level matchmaking skip was added — the lobby client requires a real matchId for its waiting-room flow, so a skip would either break the UX (observable) or be pointless; the shadowbanned user instead experiences an eternally quiet queue and can cancel/refund like anyone [TESTED: claim_match refuses both directions].

## 3. Verification evidence (local Supabase stack — full E2E, real auth, real DB)

| # | Test | Result |
|---|------|--------|
| T1 | Role gates: `get_my_admin_role` user/mod/admin; normal user cannot list reports; moderator passes mod-gate + report inbox; **moderator cannot ban**; anon /admin → /login?next=/admin; normal /admin → /lobby; mod /admin/users → /admin; admin sections 200 | **PASS [TESTED]** (API + page) |
| T2 | Temp ban: empty reason rejected at DB; `is_current_user_banned` true; §15 send silently refused; token_version 0→1; **refresh grant 400 + old access token 403 (instant revocation)**; bans row temp/active; re-signed-in banned user /lobby → /banned; /banned 200 + renders reason + suspended copy | **PASS [TESTED]** |
| T2b | Unban: empty reason rejected; profile flags cleared; fresh sign-in works; not banned; /lobby 200 | **PASS [TESTED]** |
| T3 | Shadow: no profile flag; not signed out; `is_current_user_banned` false; can still send; **partner sees ONLY own messages (shadowed history hidden retroactively)**; shadowed user sees own; `claim_match` refuses (empty TABLE); bans row shadow/active/moderator_id; no notification | **PASS [TESTED]** |
| T4 | Unshadow: partner sees all messages again; shadowed user can claim matches again | **PASS [TESTED]** |
| T5 | Warn: notification row type `admin_message`; audit 'warned_user'; authenticated INSERT into admin_audit_log blocked (42501) | **PASS [TESTED]** |
| T6 | Reports: `report_conversation` sets target_user_id; admin resolve (204); `list_reports` returns target_username; audit 'resolved_report' | **PASS [TESTED]** |
| S | Stats: signups_today ≥ 4, dau_last_24h ≥ 1, oldest_open_report_hours present | **PASS [TESTED]** |
| A | Audit trail contains banned_user / unbanned_user / shadowbanned_user / unshadowbanned_user / resolved_report; append-only enforced | **PASS [TESTED]** |
| — | `npx tsc --noEmit` clean; `npm run build` success; `npm test` 34/34 | **PASS [TESTED]** |
| — | Migration re-apply (idempotency): 0 errors; PostgREST schema cache reloaded via `NOTIFY pgrst, 'reload schema'` after DDL (required) | **PASS [TESTED]** |
| — | Page E2E round 2 (14/14): all gates + banned journey | **PASS [TESTED]** |

Test accounts (LOCAL stack only, cleaned by script on each run): `ss-e2e-{admin,mod,alice,bob}@test.local`.

## 4. Pre-existing bugs found & fixed during this phase

1. **Boolean-RPC parse bug**: `(data as boolean[])[0]` on scalar-boolean RPCs (`assert_current_user_admin` RETURNS boolean) is `undefined` → always falsy. Fixed with robust parse everywhere touched.
2. **`send_human_message` ban gap**: SECURITY DEFINER RPC bypassed the messages INSERT policy's ban check — TS `assertNotBanned` was the *only* enforcement on the real send path. Fixed at DB layer (§15).
3. **`send_human_message` grant hole**: missing from the base schema's dynamic GRANT allowlist → would 403 on fresh replays. Fixed (§16).
4. **`list_audit_log` 'all' filter**: UI passed 'all', function only treated '' as no-filter → default audit view always empty. Fixed (§17).
5. **`createClient` cookie 500**: set/remove on read-only Server Component cookies threw "Cookies can only be modified in a Server Action or Route Handler" → 500 for any page-level getUser with a dead session. Fixed (try/catch).

## 5. [NEEDS ME] — blocked on user/cloud access

1. **Apply the migration to the DESIGN Supabase DB** — no DDL path exists for any live project with the tokens I hold (service-role keys can't run DDL; no DB password anywhere; management tokens only reach two *paused* unrelated projects). Options: (a) paste `supabase/migrations/2026-11-06-02-admin-moderation.sql` into the Supabase SQL editor of the chosen DESIGN project and run it (idempotent — safe to run twice), or (b) provide a management token (sbp_) with access to the live projects, or (c) approve creating a fresh DESIGN project (I control its db password → full psql DDL + REST-copy of the ~17 dev rows). After applying, run `NOTIFY pgrst, 'reload schema';`.
2. **Promote a real moderator** (when DESIGN DB is chosen): `UPDATE profiles SET role='moderator' WHERE id = '<user-uuid>';` (I can run this via REST once DDL lands).
3. **Cloudflare Access on admin.sweetscene.love** — blocked on the DNS decision (zone is at Namecheap, not Cloudflare). Requires moving nameservers to Cloudflare first; then Access email-OTP policy for the admin email only.
4. **(Optional) Custom Access Token Hook** for claim-based token_version enforcement — current revocation is already effectively instant via `auth.sessions` deletion; the hook would add defense-in-depth at the JWT layer. Dashboard-configured.

## 6. Out of scope / deferred

- `admin/` subproject fate (retire vs keep as the 2FA surface) — user decision.
- Appeal flow UI (appeal_state column exists; no user-facing appeal form yet).
- Message deletion one-click (see decision #8).

**PHASE 4 COMPLETE — REVIEW ./migration-audit/phase4.md**
