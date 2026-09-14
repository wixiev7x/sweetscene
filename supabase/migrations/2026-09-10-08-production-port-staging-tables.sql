-- ════════════════════════════════════════════════════════════════════
-- 2026-09-10 · 08 · Port the staging-era tables to PRODUCTION
--
-- For vnugflrlzrvngopweixe ONLY, run BEFORE deploying the merged main
-- branch. Staging already has all of this; production does not, and
-- the redesigned app needs these tables for: Explore/home hosts,
-- the four matchmaking modes, invite rooms, the confessions wall and
-- the bounty board.
--
-- Shapes verified against the live staging database (2026-09-10).
-- Policies are the FINAL set (matching migrations 05-07, not the
-- original out-of-band staging ones):
--   · bots              — RLS on, NSFW row gate via is_adult_viewer
--                          (created by 06), authenticated INSERT
--   · matchmaking_queue — service-role only (no policies; the app
--                          touches it exclusively via admin client)
--   · invite_links      — service-role only
--   · confessions       — public read, anon+authed write (anonymous
--                          wall; moderation runs in the server action)
--   · bounties          — public read, authenticated write
-- Idempotent — safe to run more than once.
-- ════════════════════════════════════════════════════════════════════

-- ── bots (community AI hosts) ──
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  tagline TEXT,
  personality TEXT,
  opening_line TEXT,
  image_url TEXT,
  is_nsfw BOOLEAN DEFAULT false,
  styles TEXT[] DEFAULT '{}',
  genres TEXT[] DEFAULT '{}',
  gender TEXT CHECK (gender IS NULL OR gender IN ('female', 'male', 'other'))
);
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nsfw rows require adult viewer" ON bots;
CREATE POLICY "nsfw rows require adult viewer" ON bots
  FOR SELECT TO anon, authenticated
  USING (is_nsfw IS NOT TRUE OR is_adult_viewer());

DROP POLICY IF EXISTS "authenticated can create bots" ON bots;
CREATE POLICY "authenticated can create bots" ON bots
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── matchmaking_queue (service-role only) ──
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kink_tags TEXT[] DEFAULT '{}',
  mode TEXT NOT NULL CHECK (mode IN ('quick', 'kink', 'blind_date')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'timeout', 'cancelled')),
  preferred_gender TEXT CHECK (preferred_gender IS NULL OR preferred_gender IN ('female', 'male', 'other')),
  matched_with_user_id UUID,
  matched_at TIMESTAMPTZ,
  match_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_status ON matchmaking_queue(status);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_user ON matchmaking_queue(user_id);

-- ── invite_links (service-role only) ──
CREATE TABLE IF NOT EXISTS invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bot_id UUID,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

-- ── confessions (anonymous wall) ──
CREATE TABLE IF NOT EXISTS confessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  mood TEXT,
  likes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE confessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read confessions" ON confessions;
CREATE POLICY "anyone can read confessions" ON confessions
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "anyone can post confessions" ON confessions;
CREATE POLICY "anyone can post confessions" ON confessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- ── bounties (scene requests) ──
CREATE TABLE IF NOT EXISTS bounties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_author TEXT,
  author_id UUID,
  text TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  responses INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE bounties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read bounties" ON bounties;
CREATE POLICY "anyone can read bounties" ON bounties
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated can post bounties" ON bounties;
CREATE POLICY "authenticated can post bounties" ON bounties
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
