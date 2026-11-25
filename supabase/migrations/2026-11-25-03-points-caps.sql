-- 2026-11-25-03 — Anti-farming caps on community points (per user per UTC day).
CREATE OR REPLACE FUNCTION public.award_points(p_user uuid, p_points int, p_reason text, p_ref text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cap int := CASE p_reason
    WHEN 'creator_new_chat' THEN 60
    WHEN 'review_received' THEN 80
    WHEN 'match_completed' THEN 60
    WHEN 'daily_first_chat' THEN 2
    ELSE 50 END;
  v_today int;
BEGIN
  SELECT COALESCE(sum(points), 0) INTO v_today
    FROM points_ledger
   WHERE user_id = p_user AND reason = p_reason
     AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc');
  IF v_today + p_points > v_cap THEN
    RETURN false;
  END IF;
  INSERT INTO points_ledger (user_id, points, reason, ref_id) VALUES (p_user, p_points, p_reason, p_ref)
  ON CONFLICT (user_id, reason, ref_id) DO NOTHING;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.award_points(uuid, int, text, text) FROM PUBLIC, anon, authenticated;
