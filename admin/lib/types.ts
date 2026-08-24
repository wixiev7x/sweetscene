export type UserRole = "user" | "moderator" | "super_admin";

export interface AdminStats {
  total_users: number;
  active_bans: number;
  banned_users: number;
  open_reports: number;
  reports_24h: number;
  pending_moderation: number;
  total_moderators: number;
  total_super_admins: number;
}

export interface AdminUser {
  id: string;
  email?: string;
  username?: string;
  role: UserRole;
  is_banned: boolean;
  ban_reason?: string | null;
  banned_at?: string | null;
  created_at?: string;
}

export interface BanRecord {
  id: string;
  moderator_id: string;
  reason: string;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export interface ReportRecord {
  id: string;
  reporter_id: string | null;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AppSetting {
  id: string;
  key: string;
  category: string;
  value_text: string | null;
  is_secret: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface AuditLogRecord {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
  };
  role: UserRole;
}
