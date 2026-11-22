-- 2026-11-22-01 — Character reviews (1–5 rating + optional comment).
-- One review per user per character (upsert). Public read of visible
-- reviews; writes only via the server (service role) after moderation.

CREATE TABLE IF NOT EXISTS public.character_reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating       smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text CHECK (comment IS NULL OR char_length(comment) <= 400),
  is_hidden    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_character_reviews_char
  ON public.character_reviews (character_id, created_at DESC) WHERE NOT is_hidden;

ALTER TABLE public.character_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_reviews FROM anon, authenticated;

DROP POLICY IF EXISTS "users read own reviews" ON public.character_reviews;
CREATE POLICY "users read own reviews" ON public.character_reviews
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
GRANT SELECT ON public.character_reviews TO authenticated;
