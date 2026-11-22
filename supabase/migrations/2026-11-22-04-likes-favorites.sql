-- 2026-11-22-04 — Character likes + favorites, like_count kept in sync.
CREATE TABLE IF NOT EXISTS public.character_likes (
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, character_id)
);
CREATE TABLE IF NOT EXISTS public.character_favorites (
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, character_id)
);
ALTER TABLE public.character_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_likes, public.character_favorites FROM anon, authenticated;
GRANT SELECT ON public.character_likes, public.character_favorites TO authenticated;
DROP POLICY IF EXISTS "own likes" ON public.character_likes;
CREATE POLICY "own likes" ON public.character_likes FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own favorites" ON public.character_favorites;
CREATE POLICY "own favorites" ON public.character_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_character_like_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE characters SET like_count = like_count + 1 WHERE id = NEW.character_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE characters SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.character_id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_character_like_count ON public.character_likes;
CREATE TRIGGER trg_character_like_count AFTER INSERT OR DELETE ON public.character_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_character_like_count();
