-- 2026-11-23-01 — Public characters go live instantly; images are reviewed after.
-- Characters with an uploaded image are queued for passive moderator review
-- instead of being held in pending_review. Reports from members land in the
-- same moderation_queue (content_type='character').

CREATE OR REPLACE FUNCTION public.publish_character(p_character_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_char characters%ROWTYPE;
BEGIN
  SELECT * INTO v_char FROM characters WHERE id = p_character_id;
  IF v_char.id IS NULL THEN RAISE EXCEPTION 'Character not found'; END IF;

  IF NOT public.assert_current_user_mod() THEN
    IF v_char.creator_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Not your character'; END IF;
    IF public.is_current_user_banned() THEN RAISE EXCEPTION 'Banned users cannot publish characters'; END IF;
    IF v_char.status = 'rejected' THEN
      UPDATE characters SET status = 'draft', updated_at = now() WHERE id = p_character_id;
      RETURN 'draft';
    END IF;
  END IF;

  UPDATE characters SET status = 'published', updated_at = now() WHERE id = p_character_id;

  IF v_char.avatar_url IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM moderation_queue
     WHERE content_type = 'character' AND content_id = p_character_id::text AND status = 'pending'
  ) THEN
    INSERT INTO moderation_queue (content_type, content_id, reported_by, reason, status)
    VALUES ('character', p_character_id::text, NULL, 'auto: new public image', 'pending');
  END IF;
  RETURN 'published';
END;
$function$;

-- Owner may publish with an image; a new/changed image on a public
-- character is queued for review instead of hiding the character.
CREATE OR REPLACE FUNCTION enforce_character_status_update()
RETURNS TRIGGER AS $$
DECLARE
  v_staff boolean := auth.uid() IS NOT NULL AND public.get_effective_role(auth.uid()) IN ('admin', 'moderator');
BEGIN
  IF NEW.avatar_url IS NOT NULL
     AND NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
     AND NEW.status = 'published'
     AND auth.uid() IS NOT NULL AND NOT v_staff
     AND NOT EXISTS (SELECT 1 FROM moderation_queue WHERE content_type = 'character' AND content_id = NEW.id::text AND status = 'pending') THEN
    INSERT INTO moderation_queue (content_type, content_id, reported_by, reason, status)
    VALUES ('character', NEW.id::text, NULL, 'auto: image changed', 'pending');
  END IF;

  IF NEW.status = OLD.status OR v_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'published' THEN
    IF OLD.status = 'rejected' THEN
      RAISE EXCEPTION 'A rejected character must be edited (draft) and submitted again';
    END IF;
    IF OLD.status NOT IN ('draft', 'published', 'pending_review') THEN
      RAISE EXCEPTION 'Invalid status transition % -> %', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IN ('draft', 'pending_review', 'rejected') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid status transition % -> %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
