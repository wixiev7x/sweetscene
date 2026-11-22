"use server";

import { createAdminClient } from "@/lib/supabase/server-admin";
import { createClient } from "@/lib/supabase/server";
import { fetchFeed, viewerCanSeeAdult, type FeedCharacter } from "@/lib/home/feed";

const UUID = /^[0-9a-f-]{36}$/i;

async function currentUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await (await createClient()).auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function isVisible(id: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("characters")
    .select("is_nsfw")
    .eq("id", id)
    .eq("is_public", true)
    .eq("visibility", "public")
    .eq("status", "published")
    .eq("is_hidden", false)
    .maybeSingle();
  if (!data) return false;
  return !data.is_nsfw || (await viewerCanSeeAdult());
}

type Toggle = { ok: true; on: boolean } | { error: "auth" | "invalid" | "failed" };

async function toggle(table: "character_likes" | "character_favorites", id: string): Promise<Toggle> {
  if (typeof id !== "string" || !UUID.test(id)) return { error: "invalid" };
  const uid = await currentUserId();
  if (!uid) return { error: "auth" };
  if (!(await isVisible(id))) return { error: "invalid" };
  const admin = createAdminClient();
  const { data: existing } = await admin.from(table).select("character_id").eq("user_id", uid).eq("character_id", id).maybeSingle();
  if (existing) {
    const { error } = await admin.from(table).delete().eq("user_id", uid).eq("character_id", id);
    return error ? { error: "failed" } : { ok: true, on: false };
  }
  const { error } = await admin.from(table).insert({ user_id: uid, character_id: id });
  return error ? { error: "failed" } : { ok: true, on: true };
}

export async function toggleLike(id: string) {
  return toggle("character_likes", id);
}
export async function toggleFavorite(id: string) {
  return toggle("character_favorites", id);
}

/** Viewer's like/favorite state for one character (false/false for guests). */
export async function getMySocial(id: string): Promise<{ liked: boolean; favorited: boolean }> {
  const uid = await currentUserId();
  if (!uid || typeof id !== "string" || !UUID.test(id)) return { liked: false, favorited: false };
  const admin = createAdminClient();
  const [l, f] = await Promise.all([
    admin.from("character_likes").select("character_id").eq("user_id", uid).eq("character_id", id).maybeSingle(),
    admin.from("character_favorites").select("character_id").eq("user_id", uid).eq("character_id", id).maybeSingle(),
  ]);
  return { liked: !!l.data, favorited: !!f.data };
}

/** "More from @creator" and "You might also like" rows. */
export async function getRecommendations(id: string): Promise<{ byCreator: FeedCharacter[]; similar: FeedCharacter[] }> {
  const empty = { byCreator: [], similar: [] };
  if (typeof id !== "string" || !UUID.test(id)) return empty;
  const { data: base } = await createAdminClient()
    .from("characters")
    .select("creator_id, audience, tags")
    .eq("id", id)
    .maybeSingle();
  if (!base) return empty;
  const adult = await viewerCanSeeAdult();
  const pool = await fetchFeed({ audience: (["women", "men", "anime"].includes(base.audience) ? base.audience : "women") as "women", sort: "popular", mood: null, offset: 0, adult });
  const others = pool.filter((c) => c.id !== id);
  const tags = new Set<string>((base.tags as string[] | null) ?? []);
  const { data: sameCreator } = base.creator_id
    ? await createAdminClient().from("characters").select("id").eq("creator_id", base.creator_id).neq("id", id).limit(30)
    : { data: [] as { id: string }[] };
  const creatorIds = new Set((sameCreator ?? []).map((r) => r.id as string));
  const byCreator = base.creator_id
    ? others.filter((c) => creatorIds.has(c.id)).slice(0, 10)
    : others.filter((c) => c.creator === "SweetScene").slice(0, 10);
  const similar = others
    .filter((c) => !byCreator.some((b) => b.id === c.id))
    .map((c) => ({ c, score: c.tags.filter((t) => tags.has(t)).length }))
    .sort((a, b) => b.score - a.score || b.c.chat_count - a.c.chat_count)
    .slice(0, 10)
    .map((x) => x.c);
  return { byCreator, similar };
}
