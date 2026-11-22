"use server";

import { createAdminClient } from "@/lib/supabase/server-admin";
import { createClient } from "@/lib/supabase/server";
import { viewerCanSeeAdult } from "@/lib/home/feed";
import { moderateText } from "@/lib/utils/moderation";

export type CharacterReview = { name: string; rating: number; comment: string | null; created_at: string };
export type CharacterDetails = {
  creator: string;
  about: string | null;
  rating: number | null;
  ratingCount: number;
  reviews: CharacterReview[];
  myRating: number | null;
};

const UUID = /^[0-9a-f-]{36}$/i;

async function visibleCharacter(id: string) {
  const { data } = await createAdminClient()
    .from("characters")
    .select("id, creator_id, short_description, is_nsfw")
    .eq("id", id)
    .eq("is_public", true)
    .eq("visibility", "public")
    .eq("status", "published")
    .eq("is_hidden", false)
    .maybeSingle();
  if (!data) return null;
  if (data.is_nsfw && !(await viewerCanSeeAdult())) return null;
  return data as { id: string; creator_id: string | null; short_description: string | null };
}

/** Public detail sheet data: creator, about, rating and latest reviews. */
export async function getCharacterDetails(id: string): Promise<CharacterDetails | null> {
  if (typeof id !== "string" || !UUID.test(id)) return null;
  const c = await visibleCharacter(id);
  if (!c) return null;
  const admin = createAdminClient();

  let creator = "SweetScene";
  if (c.creator_id) {
    const { data: p } = await admin.from("profiles").select("anonymous_username").eq("id", c.creator_id).maybeSingle();
    creator = (p?.anonymous_username as string | undefined) ?? "anonymous";
  }

  const { data: rows } = await admin
    .from("character_reviews")
    .select("user_id, rating, comment, created_at")
    .eq("character_id", id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(200);
  const all = (rows ?? []) as { user_id: string; rating: number; comment: string | null; created_at: string }[];
  const ratingCount = all.length;
  const rating = ratingCount ? Math.round((all.reduce((s, r) => s + r.rating, 0) / ratingCount) * 10) / 10 : null;

  const withComments = all.filter((r) => r.comment).slice(0, 6);
  const ids = [...new Set(withComments.map((r) => r.user_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: ps } = await admin.from("profiles").select("id, anonymous_username").in("id", ids);
    for (const p of ps ?? []) names.set(p.id as string, (p.anonymous_username as string) ?? "anonymous");
  }

  let myRating: number | null = null;
  try {
    const { data: { user } } = await (await createClient()).auth.getUser();
    if (user) myRating = all.find((r) => r.user_id === user.id)?.rating ?? null;
  } catch {
    /* guest */
  }

  return {
    creator,
    about: c.short_description,
    rating,
    ratingCount,
    reviews: withComments.map((r) => ({
      name: names.get(r.user_id) ?? "anonymous",
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
    })),
    myRating,
  };
}

/** Signed-in users rate (1–5) and optionally comment. Comment is moderated. */
export async function submitCharacterReview(
  id: string,
  rating: number,
  comment: string,
): Promise<{ ok: true } | { error: string }> {
  if (typeof id !== "string" || !UUID.test(id)) return { error: "Invalid character" };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Pick 1 to 5" };
  const text = (typeof comment === "string" ? comment : "").trim().slice(0, 400);

  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return { error: "Sign in to leave a review" };
  if (!(await visibleCharacter(id))) return { error: "Character not found" };

  if (text) {
    const verdict = await moderateText(text, { surface: "review" });
    if (!verdict.allowed) return { error: "That review can't be posted" };
  }

  const { error } = await createAdminClient()
    .from("character_reviews")
    .upsert(
      { character_id: id, user_id: user.id, rating, comment: text || null, updated_at: new Date().toISOString() },
      { onConflict: "character_id,user_id" },
    );
  return error ? { error: "Couldn't save your review" } : { ok: true };
}

export type CharacterPublicCard = {
  id: string;
  name: string;
  age: number | null;
  avatar_url: string | null;
  tagline: string | null;
  short_description: string | null;
  first_message: string | null;
  tags: string[];
  like_count: number;
  chat_count: number;
  hover_card: unknown | null;
};

/** Public card data for the chat side panel (visible characters only). */
export async function getCharacterPublicCard(id: string): Promise<CharacterPublicCard | null> {
  if (typeof id !== "string" || !UUID.test(id)) return null;
  const c = await visibleCharacter(id);
  if (!c) return null;
  const { data } = await createAdminClient()
    .from("characters")
    .select("id, name, age, avatar_url, tagline, short_description, first_message, tags, like_count, chat_count, hover_card")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { ...(data as CharacterPublicCard), tags: (data.tags as string[] | null) ?? [], like_count: data.like_count ?? 0, chat_count: data.chat_count ?? 0 };
}
