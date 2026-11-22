-- 2026-11-22-03 — Creator-designed hover cards + visitor preview preference.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS hover_card JSONB;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'characters_hover_card_size') THEN
    ALTER TABLE characters ADD CONSTRAINT characters_hover_card_size
      CHECK (hover_card IS NULL OR (jsonb_typeof(hover_card) = 'object' AND pg_column_size(hover_card) <= 16000));
  END IF;
END $$;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hover_mode TEXT NOT NULL DEFAULT 'custom';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_hover_mode_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_hover_mode_check
      CHECK (hover_mode IN ('custom', 'story', 'greeting', 'off'));
  END IF;
END $$;
-- Writes go through a server action (admin client); no client grant needed.
