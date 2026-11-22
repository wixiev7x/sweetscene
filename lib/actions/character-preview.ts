"use server";

import { createAdminClient } from "@/lib/supabase/server-admin";
import { viewerCanSeeAdult } from "@/lib/home/feed";

export type CharacterPreview = {
  id: string;
  name: string;
  avatar_url: string | null;
  first_message: string | null;
  is_nsfw: boolean;
};

/**
 * Logged-out preview of a public character: name, portrait and opening
 * line only. Never returns prompts. Adult characters are only returned to
 * viewers allowed to see them (never to guests while SFW mode is on).
 */
export async function getCharacterPreview(id: string): Promise<CharacterPreview | null> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient()
    .from("characters")
    .select("id, name, avatar_url, first_message, is_nsfw")
    .eq("id", id)
    .eq("is_public", true)
    .eq("visibility", "public")
    .eq("status", "published")
    .eq("is_hidden", false)
    .maybeSingle();
  if (!data) return null;
  const c = data as CharacterPreview;
  if (c.is_nsfw && !(await viewerCanSeeAdult())) return null;
  return c;
}
