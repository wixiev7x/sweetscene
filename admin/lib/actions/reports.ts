"use server";

import { createClient } from "@/lib/supabase/server";
import type { ReportRecord } from "@/lib/types";

export async function listReports(
  status: string | null,
  page: number = 0,
  limit: number = 50
): Promise<ReportRecord[]> {
  const supabase = await createClient();

  let query = supabase
    .from("reports")
    .select(
      "id, reporter_id, target_type, target_id, reason, status, reviewed_by, reviewed_at, created_at"
    )
    .order("created_at", { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data } = await query;
  return (data as unknown as ReportRecord[]) ?? [];
}

export async function setReportStatus(
  reportId: string,
  status: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_set_report_status", {
    p_report_id: reportId,
    p_status: status,
  });

  if (error) return { error: error.message };
  return {};
}

export async function createReport(
  targetType: string,
  targetId: string,
  reason: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("reports").insert({
    target_type: targetType,
    target_id: targetId,
    reason,
  });

  if (error) return { error: error.message };
  return {};
}
