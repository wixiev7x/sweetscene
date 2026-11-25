-- 2026-11-25-01 — Community points + weekly leaderboard rewards.
CREATE TABLE IF NOT EXISTS public.points_ledger (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points     integer NOT NULL CHECK (points BETWEEN -1000 AND 1000),
  reason     text NOT NULL,
  ref_id     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reason, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_points_ledger_week ON public.points_ledger (created_at, user_id);
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.points_ledger FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.leaderboard_rewards (
  week_start date NOT NULL,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rank       integer NOT NULL,
  reward     text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (week_start, user_id)
);
ALTER TABLE public.leaderboard_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leaderboard_rewards FROM anon, authenticated;

-- Idempotent award (service role only).
CREATE OR REPLACE FUNCTION public.award_points(p_user uuid, p_points int, p_reason text, p_ref text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO points_ledger (user_id, points, reason, ref_id) VALUES (p_user, p_points, p_reason, p_ref)
  ON CONFLICT (user_id, reason, ref_id) DO NOTHING;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.award_points(uuid, int, text, text) FROM PUBLIC, anon, authenticated;

-- Public leaderboard for a week (ISO week starting Monday, UTC). No private columns.
CREATE OR REPLACE FUNCTION public.weekly_leaderboard(p_week_start date DEFAULT NULL, p_limit int DEFAULT 50)
RETURNS TABLE (rank bigint, user_id uuid, username text, avatar_url text, points bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH w AS (SELECT COALESCE(p_week_start, date_trunc('week', now() AT TIME ZONE 'utc')::date) AS s)
  SELECT row_number() OVER (ORDER BY sum(l.points) DESC, min(l.created_at)) AS rank,
         l.user_id, p.anonymous_username, p.anonymous_pfp_url, sum(l.points)::bigint
    FROM points_ledger l
    JOIN profiles p ON p.id = l.user_id
    CROSS JOIN w
   WHERE l.created_at >= w.s AND l.created_at < w.s + 7
     AND COALESCE(p.is_banned, false) = false
   GROUP BY l.user_id, p.anonymous_username, p.anonymous_pfp_url
  HAVING sum(l.points) > 0
   ORDER BY 1
   LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;
GRANT EXECUTE ON FUNCTION public.weekly_leaderboard(date, int) TO anon, authenticated;

-- Top creators by chats on their public characters.
CREATE OR REPLACE FUNCTION public.top_creators(p_limit int DEFAULT 20)
RETURNS TABLE (user_id uuid, username text, avatar_url text, characters bigint, chats bigint, likes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.creator_id, p.anonymous_username, p.anonymous_pfp_url,
         count(*)::bigint, sum(c.chat_count)::bigint, sum(c.like_count)::bigint
    FROM characters c JOIN profiles p ON p.id = c.creator_id
   WHERE c.creator_id IS NOT NULL AND c.is_public AND c.status = 'published' AND NOT c.is_hidden
     AND COALESCE(p.is_banned, false) = false
   GROUP BY c.creator_id, p.anonymous_username, p.anonymous_pfp_url
   ORDER BY 5 DESC, 6 DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 50);
$$;
GRANT EXECUTE ON FUNCTION public.top_creators(int) TO anon, authenticated;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'match_found','reveal_request','reveal_complete','new_dm','rating_received','token_refund',
  'tokens_purchased','vip_granted','admin_message','leaderboard_reward'));
