-- ============================================================================
-- SweetScene — Admin Panel Schema
-- Idempotent: safe to paste into BOTH Supabase projects (prod + staging)
-- Creates: profiles role columns, bans, reports, app_settings, audit_logs
-- Functions: get_my_role, require_aal2, is_admin, is_super_admin, log_action,
--            admin_ban_user, admin_unban_user, admin_set_setting,
--            admin_set_report_status, get_secret_setting, get_admin_stats
-- ============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── profiles table ────────────────────────────────────────────────────────
-- Create if not exists (fresh DB), or add columns to existing table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'super_admin')),
  is_banned BOOLEAN NOT NULL DEFAULT false,
  ban_reason TEXT,
  banned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add admin columns to existing profiles table (no-op if already present)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'super_admin'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- Migrate existing is_admin=true users to role='super_admin' (only if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_admin') THEN
    UPDATE public.profiles SET role = 'super_admin' WHERE is_admin = true AND role = 'user';
  END IF;
END $$;

-- ── handle_new_user trigger (for fresh DBs) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, is_banned)
  VALUES (NEW.id, 'user', false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── bans table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  moderator_id UUID REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── reports table ─────────────────────────────────────────────────────────
-- Create if not exists (fresh DB)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES auth.users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('character', 'confession', 'bounty', 'message', 'user')),
  target_id UUID,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns to existing reports table if it was already created (no-op on fresh DB)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS target_type TEXT CHECK (target_type IN ('character', 'confession', 'bounty', 'message', 'user'));
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'dismissed'));
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- ── app_settings table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('ai', 'ai_secret', 'site', 'payments')),
  value_text TEXT,
  value_enc BYTEA,
  is_secret BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── audit_logs table (append-only) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_bans_user_id ON public.bans(user_id);
CREATE INDEX IF NOT EXISTS idx_bans_active ON public.bans(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);
CREATE INDEX IF NOT EXISTS idx_app_settings_category ON public.app_settings(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================================================

-- get_my_role(): returns current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'user'
  );
$$;

-- require_aal2(): checks session has aal2 (2FA verified)
CREATE OR REPLACE FUNCTION public.require_aal2()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt()->>'aal') = 'aal2',
    false
  );
$$;

-- is_admin(): moderator or super_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_role() IN ('moderator', 'super_admin');
$$;

-- is_super_admin(): super_admin only
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_role() = 'super_admin';
$$;

-- log_action(): inserts into audit_logs
CREATE OR REPLACE FUNCTION public.log_action(
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_before JSONB DEFAULT NULL,
  p_after JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after);
END;
$$;

-- admin_ban_user(): bans a user with reason + optional expiry
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  p_target UUID,
  p_reason TEXT,
  p_expires TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_role TEXT;
  target_role TEXT;
  before_state JSONB;
BEGIN
  my_role := public.get_my_role();
  IF NOT (my_role IN ('moderator', 'super_admin')) THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  IF NOT public.require_aal2() THEN
    RAISE EXCEPTION 'Not authorized: 2FA (aal2) required';
  END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  SELECT role INTO target_role FROM public.profiles WHERE id = p_target;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;
  IF target_role IN ('moderator', 'super_admin') AND my_role != 'super_admin' THEN
    RAISE EXCEPTION 'Not authorized: cannot ban another admin';
  END IF;

  SELECT to_jsonb(p) INTO before_state FROM public.profiles p WHERE id = p_target;

  UPDATE public.profiles
  SET is_banned = true, ban_reason = p_reason, banned_at = now()
  WHERE id = p_target;

  INSERT INTO public.bans (user_id, moderator_id, reason, expires_at, active)
  VALUES (p_target, auth.uid(), p_reason, p_expires, true);

  PERFORM public.log_action(
    'banned_user',
    'user',
    p_target,
    before_state,
    jsonb_build_object('reason', p_reason, 'expires_at', p_expires, 'banned_at', now())
  );
END;
$$;

-- admin_unban_user(): lifts a ban
CREATE OR REPLACE FUNCTION public.admin_unban_user(
  p_target UUID,
  p_reason TEXT DEFAULT 'Unbanned by admin'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_role TEXT;
  before_state JSONB;
BEGIN
  my_role := public.get_my_role();
  IF NOT (my_role IN ('moderator', 'super_admin')) THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  IF NOT public.require_aal2() THEN
    RAISE EXCEPTION 'Not authorized: 2FA (aal2) required';
  END IF;

  SELECT to_jsonb(p) INTO before_state FROM public.profiles p WHERE id = p_target;

  UPDATE public.profiles
  SET is_banned = false, ban_reason = NULL, banned_at = NULL
  WHERE id = p_target;

  UPDATE public.bans SET active = false WHERE user_id = p_target AND active = true;

  PERFORM public.log_action(
    'unbanned_user',
    'user',
    p_target,
    before_state,
    jsonb_build_object('reason', p_reason)
  );
END;
$$;

-- admin_set_setting(): sets an app_settings value (encrypts secrets with pgcrypto)
CREATE OR REPLACE FUNCTION public.admin_set_setting(
  p_key TEXT,
  p_value TEXT,
  p_is_secret BOOLEAN DEFAULT false,
  p_category TEXT DEFAULT 'site',
  p_master_key TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_role TEXT;
  before_state JSONB;
  cat TEXT;
  enc_val BYTEA;
BEGIN
  my_role := public.get_my_role();

  cat := CASE
    WHEN p_is_secret AND p_category = 'ai' THEN 'ai_secret'
    WHEN p_is_secret AND p_category = 'payments' THEN 'payments'
    ELSE p_category
  END;

  IF cat IN ('ai_secret', 'payments') THEN
    IF my_role != 'super_admin' THEN
      RAISE EXCEPTION 'Not authorized: super_admin required for this setting';
    END IF;
    IF NOT public.require_aal2() THEN
      RAISE EXCEPTION 'Not authorized: 2FA (aal2) required';
    END IF;
  ELSE
    IF NOT (my_role IN ('moderator', 'super_admin')) THEN
      RAISE EXCEPTION 'Not authorized: admin access required';
    END IF;
  END IF;

  SELECT to_jsonb(s) INTO before_state FROM public.app_settings s WHERE key = p_key;

  IF p_is_secret THEN
    IF p_master_key IS NULL OR p_master_key = '' THEN
      RAISE EXCEPTION 'Master key required for secret settings';
    END IF;
    enc_val := pgp_sym_encrypt(p_value, p_master_key);
    INSERT INTO public.app_settings (key, category, value_enc, is_secret, updated_by, updated_at)
    VALUES (p_key, cat, enc_val, true, auth.uid(), now())
    ON CONFLICT (key) DO UPDATE
    SET value_enc = EXCLUDED.value_enc, value_text = NULL, is_secret = true,
        updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  ELSE
    INSERT INTO public.app_settings (key, category, value_text, is_secret, updated_by, updated_at)
    VALUES (p_key, cat, p_value, false, auth.uid(), now())
    ON CONFLICT (key) DO UPDATE
    SET value_text = EXCLUDED.value_text, value_enc = NULL, is_secret = false,
        updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  END IF;

  PERFORM public.log_action(
    'set_setting',
    'app_setting',
    NULL,
    before_state,
    jsonb_build_object('key', p_key, 'category', cat, 'is_secret', p_is_secret)
  );
END;
$$;

-- get_secret_setting(): decrypts and returns a secret setting value
CREATE OR REPLACE FUNCTION public.get_secret_setting(
  p_key TEXT,
  p_master_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enc_val BYTEA;
BEGIN
  IF public.get_my_role() != 'super_admin' THEN
    RAISE EXCEPTION 'Not authorized: super_admin required';
  END IF;
  IF NOT public.require_aal2() THEN
    RAISE EXCEPTION 'Not authorized: 2FA (aal2) required';
  END IF;

  SELECT value_enc INTO enc_val FROM public.app_settings WHERE key = p_key AND is_secret = true;
  IF enc_val IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(enc_val, p_master_key);
END;
$$;

-- admin_set_report_status(): updates a report's status (soft delete = dismissed)
CREATE OR REPLACE FUNCTION public.admin_set_report_status(
  p_report_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_role TEXT;
  before_state JSONB;
BEGIN
  my_role := public.get_my_role();
  IF NOT (my_role IN ('moderator', 'super_admin')) THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  IF NOT public.require_aal2() THEN
    RAISE EXCEPTION 'Not authorized: 2FA (aal2) required';
  END IF;
  IF p_status NOT IN ('open', 'approved', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT to_jsonb(r) INTO before_state FROM public.reports r WHERE id = p_report_id;

  UPDATE public.reports
  SET status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_report_id;

  PERFORM public.log_action(
    CASE WHEN p_status = 'dismissed' THEN 'dismissed_report' ELSE 'approved_report' END,
    'report',
    p_report_id,
    before_state,
    jsonb_build_object('status', p_status)
  );
END;
$$;

-- get_admin_stats(): dashboard counts
DROP FUNCTION IF EXISTS public.get_admin_stats();
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_role TEXT;
BEGIN
  my_role := public.get_my_role();
  IF NOT (my_role IN ('moderator', 'super_admin')) THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;

  RETURN jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_bans', (SELECT count(*) FROM public.bans WHERE active = true),
    'banned_users', (SELECT count(*) FROM public.profiles WHERE is_banned = true),
    'open_reports', (SELECT count(*) FROM public.reports WHERE status = 'open'),
    'reports_24h', (SELECT count(*) FROM public.reports WHERE created_at > now() - interval '24 hours'),
    'pending_moderation', (SELECT count(*) FROM public.reports WHERE status = 'open'),
    'total_moderators', (SELECT count(*) FROM public.profiles WHERE role = 'moderator'),
    'total_super_admins', (SELECT count(*) FROM public.profiles WHERE role = 'super_admin')
  );
END;
$$;

-- list_audit_logs(): admin-only paginated audit log
DROP FUNCTION IF EXISTS public.list_audit_logs(TEXT, INT, INT);
CREATE OR REPLACE FUNCTION public.list_audit_logs(
  p_action TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  actor_id UUID,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;

  RETURN QUERY
  SELECT al.id, al.actor_id, al.action, al.entity_type, al.entity_id,
         al.before, al.after, al.created_at
  FROM public.audit_logs al
  WHERE (p_action IS NULL OR al.action = p_action)
  ORDER BY al.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- list_ban_history(): admin-only ban history for a user
DROP FUNCTION IF EXISTS public.list_ban_history(UUID);
CREATE OR REPLACE FUNCTION public.list_ban_history(
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  moderator_id UUID,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  active BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;

  RETURN QUERY
  SELECT b.id, b.moderator_id, b.reason, b.expires_at, b.active, b.created_at
  FROM public.bans b
  WHERE b.user_id = p_user_id
  ORDER BY b.created_at DESC;
END;
$$;

-- demote_last_super_admin_guard(): prevents demoting the last super_admin
CREATE OR REPLACE FUNCTION public.prevent_last_super_admin_demote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  super_count INT;
BEGIN
  IF OLD.role = 'super_admin' AND NEW.role != 'super_admin' THEN
    SELECT count(*) INTO super_count FROM public.profiles WHERE role = 'super_admin';
    IF super_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last super_admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_super_admin_demote ON public.profiles;
CREATE TRIGGER prevent_last_super_admin_demote
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_super_admin_demote();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ── profiles ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ── bans (admin-only read, writes via function) ───────────────────────────
DROP POLICY IF EXISTS bans_select_admin ON public.bans;
CREATE POLICY bans_select_admin ON public.bans
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── reports (any authed user inserts, admin reads/updates via function) ──
DROP POLICY IF EXISTS reports_insert_any ON public.reports;
CREATE POLICY reports_insert_any ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS reports_select_admin ON public.reports;
CREATE POLICY reports_select_admin ON public.reports
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── app_settings ──────────────────────────────────────────────────────────
-- Authenticated users read only non-secret ai/site settings
DROP POLICY IF EXISTS app_settings_select_public ON public.app_settings;
CREATE POLICY app_settings_select_public ON public.app_settings
  FOR SELECT TO authenticated
  USING (category IN ('ai', 'site') AND is_secret = false);

-- Super admin + aal2 reads everything
DROP POLICY IF EXISTS app_settings_select_super_admin ON public.app_settings;
CREATE POLICY app_settings_select_super_admin ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.is_super_admin() AND public.require_aal2());

-- ── audit_logs (admin read-only, insert via function only) ────────────────
DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;
CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Revoke direct write on audit_logs (inserts only via log_action function)
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.bans TO authenticated;
GRANT SELECT ON public.reports TO authenticated;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.reports TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_aal2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_action(TEXT, TEXT, UUID, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_setting(TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_secret_setting(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_report_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_audit_logs(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_ban_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

-- ============================================================================
-- BOOTSTRAP: After running this script, promote your first super_admin:
--
--   UPDATE public.profiles SET role = 'super_admin'
--   WHERE id = '<your-user-uuid>';
--
-- Then enroll TOTP 2FA in the admin app at /login.
-- ============================================================================
