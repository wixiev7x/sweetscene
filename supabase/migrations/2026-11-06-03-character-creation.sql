-- ════════════════════════════════════════════════════════════════════
-- Phase 5 — Character creation (DESIGN first).
--
-- Adds: tagline / triggers / limits fields, the review workflow
-- (draft → pending_review → published | rejected), a DB-enforced
-- status integrity guard (owners cannot self-publish past avatar
-- review, cannot insert directly as published, cannot swap an avatar
-- on a live character without re-review), an admin review queue RPC,
-- a creator publish RPC, and the `avatars` Supabase Storage bucket
-- with row-level upload policies.
--
-- Idempotent + additive. Safe to re-run. Written for BOTH the live
-- staging DB (characters table already exists with data — existing
-- rows backfill to 'published') and a fresh replay of schema.sql.
--
-- Naming map vs. the phase plan: plan "owner_id" = existing
-- characters.creator_id (kept — staging-compatible); plan "status"
-- review axis is NEW and orthogonal to the existing
-- visibility (private/unlisted/public) sharing axis.
-- ════════════════════════════════════════════════════════════════════

-- ── §1 New character fields ─────────────────────────────────────────

ALTER TABLE characters ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS triggers TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS limits  TEXT[] NOT NULL DEFAULT '{}';

-- status: backfill existing rows as 'published' (they are live today),
-- then flip the default so NEW inserts start as 'draft'.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE characters ALTER COLUMN status SET DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'characters_status_check'
  ) THEN
    ALTER TABLE characters ADD CONSTRAINT characters_status_check
      CHECK (status IN ('draft', 'pending_review', 'published', 'rejected'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_characters_status ON characters (status)
  WHERE status IN ('pending_review', 'rejected');

-- ── §2 Snapshot gains the same fields (the matching pipeline READS
--      triggers/limits — see populate_match_snapshot §4) ─────────────

ALTER TABLE match_characters_snapshot ADD COLUMN IF NOT EXISTS tagline  TEXT;
ALTER TABLE match_characters_snapshot ADD COLUMN IF NOT EXISTS triggers TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE match_characters_snapshot ADD COLUMN IF NOT EXISTS limits   TEXT[] NOT NULL DEFAULT '{}';

-- ── §3 Review-status visibility ─────────────────────────────────────
-- Non-creators may only SELECT public characters that are ALSO
-- published. Drafts / pending_review / rejected stay owner-only
-- (admins read through SECURITY DEFINER RPCs which bypass RLS).
-- PickCharacterIds + character browse therefore never surface
-- un-reviewed content to other users.

DROP POLICY IF EXISTS "Anyone can view public or own characters" ON characters;
DROP POLICY IF EXISTS "Anyone can view published public or own characters" ON characters;
CREATE POLICY "Anyone can view published public or own characters"
  ON characters FOR SELECT
  USING ((is_public = true AND status = 'published') OR creator_id = auth.uid());

-- §3b The pre-review-era "Age-gated character viewing" policy (A5 in the
--      consolidated schema) still granted SELECT on ANY public/unlisted
--      row regardless of status — leaking pending_review/rejected
--      characters to every signed-in user [TESTED: bob could SELECT a
--      pending char while §3 said he shouldn't]. Permissive policies OR
--      together, so every SELECT policy must agree on the status gate.
--      Tighten the non-owner branches to status='published'; creators
--      keep full visibility of their own rows at every status.
DROP POLICY IF EXISTS "Age-gated character viewing" ON characters;
CREATE POLICY "Age-gated character viewing"
  ON characters FOR SELECT
  USING (
    (
      ((is_public = true OR visibility = 'unlisted') AND status = 'published')
      OR creator_id = auth.uid()
    )
    AND (
      NOT is_nsfw
      OR creator_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.age_cohort = 'adult'
          AND p.nsfw_opt_in = true
          AND p.tos_accepted_at IS NOT NULL
      )
    )
  );

-- ── §4 populate_match_snapshot — carry triggers/limits/tagline ──────

CREATE OR REPLACE FUNCTION populate_match_snapshot(
  p_match_id UUID,
  p_character_ids UUID[]
) RETURNS VOID AS $$
DECLARE
  cid UUID;
BEGIN
  FOREACH cid IN ARRAY p_character_ids LOOP
    INSERT INTO match_characters_snapshot
      (match_id, character_id, name, personality, first_message,
       system_prompt, is_nsfw, version, tagline, triggers, limits)
    SELECT p_match_id, c.id, c.name, c.personality, c.first_message,
           COALESCE(c.system_prompt, c.user_prompt), COALESCE(c.is_nsfw, false),
           c.version, c.tagline, c.triggers, c.limits
    FROM characters c
    WHERE c.id = cid;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION populate_match_snapshot(UUID, UUID[]) FROM anon;
REVOKE EXECUTE ON FUNCTION populate_match_snapshot(UUID, UUID[]) FROM authenticated;

-- ── §5 Status integrity guards (triggers) ───────────────────────────
-- Table-level UPDATE grants exist for `authenticated`, so column
-- REVOKEs cannot protect `status`. Triggers are the enforcement:
--
--   * INSERT by a non-staff user is forced to 'draft' no matter what
--     the payload claims (kills "insert directly as published").
--   * UPDATE by a non-staff user: 'published' requires either no
--     avatar or prior staff approval (OLD.status = 'published' means
--     it was already live/approved); a rejected character cannot jump
--     straight back to published (must go draft → publish, where the
--     avatar rule re-applies); any avatar swap on a live character
--     auto-demotes to 'pending_review' so the new image is reviewed.
--   * Staff (admin/moderator) transitions are unrestricted —
--     admin_review_character runs SECURITY DEFINER and auth.uid()
--     still resolves to the calling staff member inside the trigger.
--   * Service-role/postgres inserts (auth.uid() IS NULL) keep the
--     status they provide, so default-character seeding still works.

CREATE OR REPLACE FUNCTION enforce_character_status_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND public.get_effective_role(auth.uid()) NOT IN ('admin', 'moderator') THEN
    NEW.status := 'draft';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
/* SECURITY DEFINER: triggers execute with the INVOKING user's privileges,
   and get_effective_role is EXECUTE-revoked for authenticated/anon — an
   invoker-context trigger would fail the insert with 42501 [TESTED]. */

DROP TRIGGER IF EXISTS characters_status_insert_guard ON characters;
CREATE TRIGGER characters_status_insert_guard
  BEFORE INSERT ON characters
  FOR EACH ROW EXECUTE FUNCTION enforce_character_status_insert();

CREATE OR REPLACE FUNCTION enforce_character_status_update()
RETURNS TRIGGER AS $$
BEGIN
  /* Avatar swap on a live character → re-review, silently.
     (The TS publish path does this explicitly too; the trigger is
     the backstop for direct REST writes.) */
  IF OLD.status = 'published'
     AND NEW.status = 'published'
     AND NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
     AND auth.uid() IS NOT NULL
     AND public.get_effective_role(auth.uid()) NOT IN ('admin', 'moderator') THEN
    NEW.status := 'pending_review';
  END IF;

  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  /* Staff may drive any transition (approve/reject/re-publish). */
  IF auth.uid() IS NOT NULL
     AND public.get_effective_role(auth.uid()) IN ('admin', 'moderator') THEN
    RETURN NEW;
  END IF;

  /* Owner rules (RLS already limits UPDATE to the creator). */
  IF NEW.status = 'published' THEN
    IF OLD.status = 'rejected' THEN
      RAISE EXCEPTION 'A rejected character must be edited (draft) and submitted again';
    END IF;
    IF NEW.avatar_url IS NOT NULL THEN
      RAISE EXCEPTION 'Characters with an avatar must pass review before publishing';
    END IF;
    IF OLD.status NOT IN ('draft', 'published') THEN
      RAISE EXCEPTION 'Invalid status transition % -> %', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
  END IF;

  /* Any demotion (draft / pending_review / rejected) by the owner is
     safe — it only ever hides their own character. */
  IF NEW.status IN ('draft', 'pending_review', 'rejected') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid status transition % -> %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
/* SECURITY DEFINER — same reason as enforce_character_status_insert. */

DROP TRIGGER IF EXISTS characters_status_update_guard ON characters;
CREATE TRIGGER characters_status_update_guard
  BEFORE UPDATE OF status, avatar_url ON characters
  FOR EACH ROW EXECUTE FUNCTION enforce_character_status_update();

-- ── §6 publish_character — creator-side submit-for-review ───────────
-- Called by the builder UI. Enforces the avatar rule server-side:
-- no avatar → published immediately; avatar → pending_review.
-- Only the creator (or staff) can publish; banned users cannot.

CREATE OR REPLACE FUNCTION publish_character(
  p_character_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_char characters%ROWTYPE;
BEGIN
  IF NOT public.assert_current_user_mod() THEN
    SELECT * INTO v_char FROM characters WHERE id = p_character_id;
    IF v_char.id IS NULL THEN
      RAISE EXCEPTION 'Character not found';
    END IF;
    IF v_char.creator_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Not your character';
    END IF;
    IF public.is_current_user_banned() THEN
      RAISE EXCEPTION 'Banned users cannot publish characters';
    END IF;
    IF v_char.status = 'rejected' THEN
      /* Editing resets to draft; publishing straight out of rejected
         is blocked by the trigger — force the honest path. */
      UPDATE characters SET status = 'draft', updated_at = now()
       WHERE id = p_character_id;
      RETURN 'draft';
    END IF;
    UPDATE characters
       SET status = CASE WHEN avatar_url IS NOT NULL
                         THEN 'pending_review' ELSE 'published' END,
           updated_at = now()
     WHERE id = p_character_id;
    RETURN CASE WHEN v_char.avatar_url IS NOT NULL
                THEN 'pending_review' ELSE 'published' END;
  ELSE
    /* Staff override: publish regardless of avatar (matches the
       trigger's staff exemption — used by the review queue itself). */
    UPDATE characters SET status = 'published', updated_at = now()
     WHERE id = p_character_id;
    RETURN 'published';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION publish_character(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION publish_character(UUID) TO authenticated;

-- ── §7 admin_review_character — the review queue action ─────────────

CREATE OR REPLACE FUNCTION admin_review_character(
  p_character_id UUID,
  p_decision TEXT,
  p_note TEXT DEFAULT ''
) RETURNS VOID AS $$
DECLARE
  v_mod   UUID := auth.uid();
  v_char  characters%ROWTYPE;
BEGIN
  IF NOT public.assert_current_user_mod() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT * INTO v_char FROM characters WHERE id = p_character_id;
  IF v_char.id IS NULL THEN
    RAISE EXCEPTION 'Character not found';
  END IF;
  IF v_char.status <> 'pending_review' THEN
    RAISE EXCEPTION 'Character is not pending review (status: %)', v_char.status;
  END IF;

  UPDATE characters
     SET status = CASE WHEN p_decision = 'approved'
                       THEN 'published' ELSE 'rejected' END,
         updated_at = now()
   WHERE id = p_character_id;

  INSERT INTO admin_audit_log (admin_id, action, target_id, target_type, reason, metadata)
  VALUES (v_mod,
          CASE WHEN p_decision = 'approved'
               THEN 'approved_character' ELSE 'rejected_character' END,
          p_character_id, 'character',
          coalesce(nullif(trim(p_note), ''), p_decision),
          jsonb_build_object('name', v_char.name,
                             'decision', p_decision,
                             'had_avatar', v_char.avatar_url IS NOT NULL));

  IF v_char.creator_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_char.creator_id, 'admin_message',
      CASE WHEN p_decision = 'approved'
           THEN 'Character approved'
           ELSE 'Character not approved' END,
      CASE WHEN p_decision = 'approved'
           THEN coalesce(nullif(trim(p_note), ''),
                         'Your character passed review and is now live.')
           ELSE coalesce(nullif(trim(p_note), ''),
                         'Your character did not pass review. Edit it and publish again.') END);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION admin_review_character(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION admin_review_character(UUID, TEXT, TEXT) TO authenticated;

-- ── §8 list_characters_pending_review — queue feed ──────────────────

CREATE OR REPLACE FUNCTION list_characters_pending_review(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  name TEXT,
  tagline TEXT,
  avatar_url TEXT,
  creator_id UUID,
  creator_username TEXT,
  is_nsfw BOOLEAN,
  category TEXT,
  triggers TEXT[],
  limits TEXT[],
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.assert_current_user_mod() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
    SELECT c.id, c.name, c.tagline, c.avatar_url, c.creator_id,
           COALESCE(p.anonymous_username, 'user ' || left(p.id::text, 8)),
           COALESCE(c.is_nsfw, false), c.category,
           c.triggers, c.limits, c.updated_at
      FROM characters c
      LEFT JOIN profiles p ON p.id = c.creator_id
     WHERE c.status = 'pending_review'
     ORDER BY c.updated_at ASC
     LIMIT coalesce(p_limit, 50) OFFSET coalesce(p_offset, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION list_characters_pending_review(INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION list_characters_pending_review(INT, INT) TO authenticated;

-- ── §9 Storage: `avatars` bucket + policies ─────────────────────────
-- Public-read bucket, authenticated uploads confined to the uploader's
-- own folder (uid/...), 2 MB cap, image mime types only. Created via
-- SQL so the bucket exists wherever this migration runs (dashboard
-- "New bucket" clicks are not required).

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  UPDATE storage.buckets
     SET file_size_limit = 2097152,
         allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
   WHERE id = 'avatars';
EXCEPTION WHEN undefined_column THEN
  /* Older storage schema — the limits are then enforced client-side. */
  NULL;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND policyname = 'avatars_public_read'
  ) THEN
    CREATE POLICY avatars_public_read
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'avatars');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND policyname = 'avatars_owner_upload'
  ) THEN
    CREATE POLICY avatars_owner_upload
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'avatars'
                  AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND policyname = 'avatars_owner_delete'
  ) THEN
    CREATE POLICY avatars_owner_delete
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'avatars'
             AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END
$$;

-- ── §10 Grants note ─────────────────────────────────────────────────
-- No new EXECUTE grants for authenticated beyond publish_character /
-- admin_review_character / list_characters_pending_review above
-- (guarded internally by assert_current_user_mod or creator checks).

-- ── §11 Local-dev avatar URL allowance ──────────────────────────────
-- characters.avatar_url / profiles.anonymous_pfp_url carry a CHECK
-- constraint calling is_safe_avatar_url(), which only allows
-- https://*.supabase.co/storage/v1/ (plus Pollinations/Unsplash). The
-- supabase CLI dev stack serves storage over plain http on loopback
-- (http://127.0.0.1:54321/storage/v1/…), so uploaded avatars would be
-- rejected by the DB even though lib/utils/url.ts (Phase 5) allows the
-- same loopback-http case when NEXT_PUBLIC_SUPABASE_URL is http.
-- The regex below widens the DB rule to loopback hosts ONLY — a
-- production hostname is never loopback, so this cannot weaken the
-- production constraint. Replacing the function updates the existing
-- named CHECK constraints (they call it on every write).
CREATE OR REPLACE FUNCTION is_safe_avatar_url(p_url TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- No avatar is always fine.
  IF p_url IS NULL OR p_url = '' THEN
    RETURN true;
  END IF;

  IF length(p_url) > 2048 THEN
    RETURN false;
  END IF;

  -- Characters that break out of `url(...)` in CSS or out of an HTML
  -- attribute. A conforming https URL never needs these unescaped.
  IF p_url ~ '["''()\;{}<>]' OR p_url ~ '\s' THEN
    RETURN false;
  END IF;

  -- https only, on a host the platform already trusts — plus the
  -- loopback-http case for local dev storage (see comment above).
  RETURN p_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/'
      OR p_url ~ '^https://image\.pollinations\.ai/'
      OR p_url ~ '^https://images\.unsplash\.com/'
      OR p_url ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?/storage/v1/';
END;
$$ LANGUAGE plpgsql IMMUTABLE;
