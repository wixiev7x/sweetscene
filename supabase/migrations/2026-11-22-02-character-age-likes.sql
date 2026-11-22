-- 2026-11-22-02 — Character display age (adults only) + like counter.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS age SMALLINT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'characters_age_adult') THEN
    ALTER TABLE characters ADD CONSTRAINT characters_age_adult CHECK (age IS NULL OR age BETWEEN 18 AND 120);
  END IF;
END $$;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;
