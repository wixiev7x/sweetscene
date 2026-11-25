-- 2026-11-25-02 — Characters are written only through server actions.
-- Owners could PATCH any column via PostgREST (like_count, is_nsfw,
-- prompts, hover_card), skipping validation/moderation/age gates.
-- Server actions now use the service role after their own checks.
-- DELETE stays (RLS limits it to the owner).
REVOKE INSERT, UPDATE ON public.characters FROM anon, authenticated;
-- Raw author prompt is never needed by browsers.
REVOKE SELECT (user_prompt) ON public.characters FROM anon;
