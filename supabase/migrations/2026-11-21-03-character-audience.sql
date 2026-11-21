-- 2026-11-21-03 — Character audience (homepage tabs: Women · Men · Anime).
-- Idempotent. Creators pick it in the create/edit forms; existing rows
-- default to 'other' (shown under every tab's "All" fallback only).

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'other';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'characters_audience_check'
  ) THEN
    ALTER TABLE characters
      ADD CONSTRAINT characters_audience_check
      CHECK (audience IN ('women', 'men', 'anime', 'other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_characters_audience_feed
  ON characters (audience, is_featured DESC, chat_count DESC)
  WHERE is_public AND NOT is_hidden;
