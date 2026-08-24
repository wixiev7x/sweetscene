"use server";

import { createClient } from "@/lib/supabase/server";
import type { AppSetting } from "@/lib/types";

export async function getSettings(): Promise<AppSetting[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("app_settings")
    .select("id, key, category, value_text, is_secret, updated_by, updated_at")
    .order("category", { ascending: true })
    .order("key", { ascending: true });

  return (data as unknown as AppSetting[]) ?? [];
}

export async function setSetting(
  key: string,
  value: string,
  isSecret: boolean,
  category: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_set_setting", {
    p_key: key,
    p_value: value,
    p_is_secret: isSecret,
    p_category: category,
    p_master_key: process.env.SETTINGS_MASTER_KEY,
  });

  if (error) return { error: error.message };
  return {};
}

export async function getSecretSetting(
  key: string
): Promise<{ value?: string; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_secret_setting", {
    p_key: key,
    p_master_key: process.env.SETTINGS_MASTER_KEY,
  });

  if (error) return { error: error.message };
  return { value: data as string };
}
