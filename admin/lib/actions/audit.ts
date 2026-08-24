"use server";

import { createClient } from "@/lib/supabase/server";
import type { AuditLogRecord } from "@/lib/types";

export async function listAuditLogs(
  action: string | null,
  page: number = 0,
  limit: number = 50
): Promise<AuditLogRecord[]> {
  const supabase = await createClient();

  const { data } = await supabase.rpc("list_audit_logs", {
    p_action: action || null,
    p_limit: limit,
    p_offset: page * limit,
  });

  return (data as unknown as AuditLogRecord[]) ?? [];
}
