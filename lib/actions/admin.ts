"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import {
  MANAGED_SETTINGS,
  maskSecret,
  invalidateSetting,
  type SettingKey,
} from "@/lib/config/settings";

/* ════════════════════════════════════════════════════════════════════
 * Phase 10 — Admin server actions.
 *
 * S21: assertAdmin is the auth guard wrapper. Every function calls
 * this first. It reads the caller's profile via the user client (RLS)
 * and checks is_admin. RPCs also double-check via
 * assert_current_user_admin() SECURITY DEFINER — defense-in-depth so
 * even if a service_role key leaks, a non-admin can't invoke them.
 * ════════════════════════════════════════════════════════════════════ */

/* ── Types ── */

export type ReportRow = {
  id: string;
  reporter_id: string;
  match_id: string;
  reason: string;
  evidence_snapshot: unknown;
  status: string;
  resolution_note: string | null;
  created_at: string;
  reporter_username: string;
};

export type AdminUserRow = {
  id: string;
  anonymous_username: string;
  anonymous_pfp_url: string | null;
  reputation_score: number;
  tokens_balance: number;
  is_vip: boolean;
  is_admin: boolean;
  is_banned: boolean;
  banned_until: string | null;
  created_at: string;
};

export type AdminCharacterRow = {
  id: string;
  name: string;
  creator_id: string | null;
  visibility: string;
  is_nsfw: boolean;
  is_featured: boolean;
  is_hidden: boolean;
  chat_count: number;
  created_at: string;
  creator_username: string | null;
};

export type AdminStats = {
  open_reports: number;
  total_reports: number;
  total_users: number;
  total_characters: number;
  banned_users: number;
  featured_characters: number;
};

export type AdminStatsV2 = {
  open_reports: number;
  total_reports: number;
  total_users: number;
  total_characters: number;
  banned_users: number;
  featured_characters: number;
  active_bans: number;
  pending_moderation: number;
  reports_last_24h: number;
};

export type ModerationQueueRow = {
  id: string;
  content_type: string;
  content_id: string;
  reported_by: string | null;
  reason: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  admin_id: string;
  action: string;
  target_id: string | null;
  target_type: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
};

export type BanHistoryRow = {
  id: string;
  banned_by: string;
  reason: string;
  banned_at: string;
  expires_at: string | null;
  active: boolean;
};

export type AdminUserWithEmail = {
  id: string;
  email: string;
  anonymous_username: string;
  reputation_score: number;
  tokens_balance: number;
  is_vip: boolean;
  is_admin: boolean;
  is_banned: boolean;
  banned_until: string | null;
  created_at: string;
};

/* ── Guard ── */

async function assertAdmin(): Promise<string> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await supabase.rpc("assert_current_user_admin");
  const isAdmin = (data as unknown as boolean[] | null)?.[0];

  if (!isAdmin) throw new Error("Not authorized");

  return user.id;
}

/* ── Stats ── */

export async function getAdminStats(): Promise<AdminStats | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_stats");

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { error: "Failed to load stats" };
  }

  return data[0] as AdminStats;
}

/* ── Reports ── */

export async function listReports(
  status: string = "open",
  limit: number = 50,
  offset: number = 0
): Promise<{ reports: ReportRow[] } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_reports", {
    p_status: status,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) return { error: "Failed to load reports" };

  return { reports: (data ?? []) as ReportRow[] };
}

export async function resolveReport(
  reportId: string,
  resolution: "resolved" | "dismissed",
  note: string = ""
): Promise<{ success: true } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_report", {
    p_report_id: reportId,
    p_resolution: resolution,
    p_note: note,
  });

  if (error) return { error: "Failed to resolve report" };

  return { success: true };
}

/* ── Users ── */

export async function listUsers(
  search: string = "",
  limit: number = 50,
  offset: number = 0
): Promise<{ users: AdminUserRow[] } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_admin_users", {
    p_search: search,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) return { error: "Failed to load users" };

  return { users: (data ?? []) as AdminUserRow[] };
}

export async function banUser(
  userId: string,
  bannedUntil: string | null
): Promise<{ success: true } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("ban_user", {
    p_user_id: userId,
    p_banned_until: bannedUntil,
  });

  if (error) return { error: "Failed to ban user" };

  return { success: true };
}

export async function unbanUser(
  userId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("unban_user", {
    p_user_id: userId,
  });

  if (error) return { error: "Failed to unban user" };

  return { success: true };
}

export async function grantTokens(
  userId: string,
  amount: number
): Promise<{ success: true } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  if (!Number.isInteger(amount) || amount === 0) {
    return { error: "Amount must be a non-zero integer" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_grant_tokens", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) return { error: "Failed to grant tokens" };

  return { success: true };
}

/* ── Characters ── */

export async function listCharacters(
  search: string = "",
  limit: number = 50,
  offset: number = 0
): Promise<{ characters: AdminCharacterRow[] } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_admin_characters", {
    p_search: search,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) return { error: "Failed to load characters" };

  return { characters: (data ?? []) as AdminCharacterRow[] };
}

export async function setCharacterFlag(
  characterId: string,
  flag: "is_featured" | "is_hidden",
  value: boolean
): Promise<{ success: true } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_character_flag", {
    p_character_id: characterId,
    p_flag: flag,
    p_value: value,
  });

  if (error) return { error: "Failed to update character" };

  return { success: true };
}

export async function deleteCharacter(
  characterId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_character", {
    p_character_id: characterId,
  });

  if (error) return { error: "Failed to delete character" };

  return { success: true };
}

/* ════════════════════════════════════════════════════════════════════
 * Phase 12 — Platform settings (cloud-managed credentials).
 *
 * The operator sets API keys here instead of baking them into the
 * deployment, so rotating a leaked key is a form submit rather than a
 * redeploy. lib/config/settings.ts resolves each key from this table
 * first and falls back to the matching env var.
 *
 * SECURITY invariants for everything below:
 *   1. assertAdmin() first, always.
 *   2. The key is validated against the MANAGED_SETTINGS whitelist. A
 *      server action's arguments arrive off the wire, so `key` is
 *      attacker-controlled input even though the caller is an admin.
 *   3. A raw value NEVER leaves the server. listPlatformSettings
 *      returns maskSecret() previews only; there is deliberately no
 *      "reveal" action. If the operator loses a key they rotate it at
 *      the provider — that is the correct recovery path anyway.
 *   4. Values are written with the service-role client because
 *      platform_settings has RLS on with no policies (see schema.sql).
 * ════════════════════════════════════════════════════════════════════ */

export type PlatformSettingRow = {
  key: SettingKey;
  label: string;
  env: string;
  hint: string;
  secret: boolean;
  /** Where the running app is currently reading this value from. */
  source: "database" | "environment" | "unset";
  /** Masked preview (e.g. "sk-a…3f9"), or null when unset. */
  preview: string | null;
  updatedAt: string | null;
};

/** Longest accepted value. Real credentials are well under this. */
const MAX_SETTING_VALUE_LENGTH = 4096;

function findDescriptor(key: string) {
  return MANAGED_SETTINGS.find((s) => s.key === key) ?? null;
}

export async function listPlatformSettings(): Promise<
  { settings: PlatformSettingRow[] } | { error: string }
> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_settings")
    .select("key, value, updated_at");

  if (error) return { error: "Failed to load settings" };

  const stored = new Map<string, { value: string | null; updated_at: string }>();
  for (const row of (data ?? []) as Array<{
    key: string;
    value: string | null;
    updated_at: string;
  }>) {
    stored.set(row.key, { value: row.value, updated_at: row.updated_at });
  }

  const settings: PlatformSettingRow[] = MANAGED_SETTINGS.map((d) => {
    const row = stored.get(d.key);
    const dbValue = row?.value?.trim() || null;
    const envValue = process.env[d.env]?.trim() || null;

    const source: PlatformSettingRow["source"] = dbValue
      ? "database"
      : envValue
        ? "environment"
        : "unset";

    const effective = dbValue ?? envValue;

    return {
      key: d.key,
      label: d.label,
      env: d.env,
      hint: d.hint,
      secret: d.secret,
      source,
      /* Non-secret values (endpoint URL, model name) are shown in full
         — they are not credentials and the operator needs to read them
         back to confirm what the platform is pointed at. */
      preview: effective
        ? d.secret
          ? maskSecret(effective)
          : effective
        : null,
      updatedAt: row?.updated_at ?? null,
    };
  });

  return { settings };
}

export async function setPlatformSetting(
  key: string,
  value: string
): Promise<{ success: true } | { error: string }> {
  let adminId: string;
  try {
    adminId = await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const descriptor = findDescriptor(key);
  if (!descriptor) return { error: "Unknown setting" };

  if (typeof value !== "string") return { error: "Invalid value" };

  /* Pasted credentials routinely carry a trailing newline. */
  const trimmed = value.trim();

  if (!trimmed) return { error: "Value cannot be empty. Use Clear instead." };
  if (trimmed.length > MAX_SETTING_VALUE_LENGTH) {
    return { error: "Value is too long" };
  }

  /* A newline or control character inside a credential is a header
     injection primitive: these values are interpolated into outbound
     request headers (Authorization, x-goog-api-key). Reject rather
     than silently strip so the operator sees the paste was wrong. */
  if (/[\x00-\x1f\x7f]/.test(trimmed)) {
    return { error: "Value contains invalid control characters" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("platform_settings").upsert(
    {
      key: descriptor.key,
      value: trimmed,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    },
    { onConflict: "key" }
  );

  if (error) return { error: "Failed to save setting" };

  /* Drop the 30s read cache so the change takes effect immediately
     rather than after the next TTL expiry. */
  invalidateSetting(descriptor.key);

  return { success: true };
}

export async function clearPlatformSetting(
  key: string
): Promise<{ success: true } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const descriptor = findDescriptor(key);
  if (!descriptor) return { error: "Unknown setting" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_settings")
    .delete()
    .eq("key", descriptor.key);

  if (error) return { error: "Failed to clear setting" };

  invalidateSetting(descriptor.key);

  return { success: true };
}

/* ── Ban maintenance ── */

/**
 * Sweeps expired temporary bans. banned_until is a point in time, and
 * is_current_user_banned() already treats a past timestamp as unbanned,
 * so this is housekeeping (keeps is_banned honest for admin listings)
 * rather than an enforcement path.
 */
export async function expireBans(): Promise<
  { expired: number } | { error: string }
> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("expire_bans");

  if (error) return { error: "Failed to expire bans" };

  return { expired: (data as unknown as number) ?? 0 };
}

/* ── Phase 16: Moderation queue, audit log, ban-with-reason ── */

export async function getAdminStatsV2(): Promise<
  AdminStatsV2 | { error: string }
> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_stats_v2");

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { error: "Failed to load stats" };
  }

  return data[0] as AdminStatsV2;
}

export async function listModerationQueue(
  status: string = "pending",
  contentType: string | null = null,
  limit: number = 50,
  offset: number = 0
): Promise<{ items: ModerationQueueRow[] } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_moderation_queue", {
    p_status: status,
    p_content_type: contentType,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) return { error: "Failed to load moderation queue" };

  return { items: (data ?? []) as ModerationQueueRow[] };
}

export async function resolveModerationItem(
  itemId: string,
  resolution: "approved" | "removed"
): Promise<{ success: true } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_moderation_item", {
    p_item_id: itemId,
    p_resolution: resolution,
  });

  if (error) return { error: "Failed to resolve moderation item" };

  return { success: true };
}

export async function listAuditLog(
  action: string | null = null,
  limit: number = 50,
  offset: number = 0
): Promise<{ entries: AuditLogRow[] } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_audit_log", {
    p_action: action,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) return { error: "Failed to load audit log" };

  return { entries: (data ?? []) as AuditLogRow[] };
}

export async function banUserWithReason(
  userId: string,
  reason: string,
  expiresAt: string | null
): Promise<{ success: true } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  if (!reason.trim()) return { error: "A reason is required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("ban_user_with_reason", {
    p_user_id: userId,
    p_reason: reason.trim(),
    p_expires_at: expiresAt,
  });

  if (error) return { error: "Failed to ban user" };

  return { success: true };
}

export async function unbanUserWithReason(
  userId: string,
  reason: string
): Promise<{ success: true } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  if (!reason.trim()) return { error: "A reason is required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("unban_user_with_reason", {
    p_user_id: userId,
    p_reason: reason.trim(),
  });

  if (error) return { error: "Failed to unban user" };

  return { success: true };
}

export async function listBanHistory(
  userId: string
): Promise<{ bans: BanHistoryRow[] } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_ban_history", {
    p_user_id: userId,
  });

  if (error) return { error: "Failed to load ban history" };

  return { bans: (data ?? []) as BanHistoryRow[] };
}

export async function searchUsersByEmail(
  email: string
): Promise<{ users: AdminUserWithEmail[] } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const trimmed = email.trim();
  if (!trimmed) return { users: [] };

  const admin = createAdminClient();

  const {
    data: { users },
    error: listError,
  } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) return { error: "Failed to search users" };

  const lower = trimmed.toLowerCase();
  const matched = users.filter((u) =>
    u.email?.toLowerCase().includes(lower)
  );

  if (matched.length === 0) return { users: [] };

  const ids = matched.map((u) => u.id);
  const { data: profiles } = await admin
    .from("profiles")
    .select(
      "id, anonymous_username, reputation_score, tokens_balance, is_vip, is_admin, is_banned, banned_until, created_at"
    )
    .in("id", ids);

  const profileMap = new Map<
    string,
    {
      id: string;
      anonymous_username: string;
      reputation_score: number;
      tokens_balance: number;
      is_vip: boolean;
      is_admin: boolean;
      is_banned: boolean;
      banned_until: string | null;
      created_at: string;
    }
  >();
  for (const p of (profiles ?? []) as Array<{
    id: string;
    anonymous_username: string;
    reputation_score: number;
    tokens_balance: number;
    is_vip: boolean;
    is_admin: boolean;
    is_banned: boolean;
    banned_until: string | null;
    created_at: string;
  }>) {
    profileMap.set(p.id, p);
  }

  const result: AdminUserWithEmail[] = matched.map((u) => {
    const p = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      anonymous_username: p?.anonymous_username ?? "—",
      reputation_score: p?.reputation_score ?? 0,
      tokens_balance: p?.tokens_balance ?? 0,
      is_vip: p?.is_vip ?? false,
      is_admin: p?.is_admin ?? false,
      is_banned: p?.is_banned ?? false,
      banned_until: p?.banned_until ?? null,
      created_at: p?.created_at ?? u.created_at ?? "",
    };
  });

  return { users: result };
}

export async function flagContent(
  contentType: string,
  contentId: string,
  reason: string
): Promise<{ success: true } | { error: string }> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  if (!reason.trim()) return { error: "A reason is required" };

  const admin = createAdminClient();
  const adminId = await assertAdmin();

  const { error } = await admin.from("moderation_queue").insert({
    content_type: contentType,
    content_id: contentId,
    reported_by: adminId,
    reason: reason.trim(),
    status: "pending",
  });

  if (error) return { error: "Failed to flag content" };

  return { success: true };
}

/* ── Current user check (for client pages) ── */

export async function isAdmin(): Promise<boolean> {
  try {
    await assertAdmin();
    return true;
  } catch {
    return false;
  }
}