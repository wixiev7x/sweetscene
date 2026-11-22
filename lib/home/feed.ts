import "server-only";

import { createAdminClient } from "@/lib/supabase/server-admin";
import { createClient } from "@/lib/supabase/server";
import { SFW_MODE } from "@/lib/utils/sfw";

/* ════════════════════════════════════════════════════════════════════
 * Homepage feed — public characters for the character-first landing.
 *
 * Runs with the admin client so logged-out visitors can browse, but
 * applies the same discoverability rules as getPublicCharacters
 * (public + published + not hidden) and selects only public columns —
 * never system_prompt / user_prompt.
 *
 * Adult content: excluded while SFW_MODE is on. With SFW_MODE off it is
 * included only for a signed-in adult-cohort viewer who has opted in.
 * Minors (16–17) can never receive it — decided server-side here.
 * ════════════════════════════════════════════════════════════════════ */

export const AUDIENCES = ["women", "men", "anime"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const SORTS = ["popular", "new", "featured"] as const;
export type FeedSort = (typeof SORTS)[number];
export const MOODS = ["Romance", "Fantasy", "Dark", "Drama", "Slice of life", "Adventure"] as const;

export type FeedCharacter = {
  id: string;
  name: string;
  tagline: string | null;
  short_description: string | null;
  first_message: string | null;
  avatar_url: string | null;
  tags: string[];
  chat_count: number;
  is_featured: boolean;
  is_nsfw: boolean;
  created_at: string;
  age: number | null;
  like_count: number;
  audience: string;
  creator: string;
};

const COLUMNS =
  "id, name, tagline, short_description, first_message, avatar_url, tags, chat_count, is_featured, is_nsfw, created_at, age, like_count, audience, creator_id";

export const PAGE_SIZE = 24;

export async function viewerCanSeeAdult(): Promise<boolean> {
  if (SFW_MODE) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.rpc("get_own_profile").maybeSingle();
    const p = data as { age_cohort?: string | null; nsfw_opt_in?: boolean | null } | null;
    return p?.age_cohort === "adult" && p?.nsfw_opt_in === true;
  } catch {
    return false;
  }
}

export function parseAudience(v: unknown): Audience {
  return AUDIENCES.includes(v as Audience) ? (v as Audience) : "women";
}
export function parseSort(v: unknown): FeedSort {
  return SORTS.includes(v as FeedSort) ? (v as FeedSort) : "popular";
}
export function parseMood(v: unknown): string | null {
  return MOODS.includes(v as (typeof MOODS)[number]) ? (v as string) : null;
}

export async function fetchFeed(opts: {
  audience: Audience;
  sort: FeedSort;
  mood: string | null;
  offset: number;
  adult: boolean;
}): Promise<FeedCharacter[]> {
  const admin = createAdminClient();
  const build = (withAudience: boolean) => {
    let q = admin
      .from("characters")
      .select(COLUMNS)
      .eq("is_public", true)
      .eq("visibility", "public")
      .eq("status", "published")
      .eq("is_hidden", false);
    if (withAudience) q = q.eq("audience", opts.audience);
    if (!opts.adult) q = q.eq("is_nsfw", false);
    if (opts.mood) q = q.contains("tags", [opts.mood]);
    if (opts.sort === "new") q = q.order("created_at", { ascending: false });
    else if (opts.sort === "featured")
      q = q.order("is_featured", { ascending: false }).order("chat_count", { ascending: false });
    else q = q.order("chat_count", { ascending: false }).order("created_at", { ascending: false });
    return q.range(opts.offset, opts.offset + PAGE_SIZE - 1);
  };

  let { data, error } = await build(true);
  /* Environment without the audience column yet (migration pending):
     fall back to an unsplit feed rather than an empty page. */
  if (error && error.code === "42703") ({ data, error } = await build(false));
  if (error || !data) return [];
  const rows = data as unknown as (Omit<FeedCharacter, "creator"> & { creator_id: string | null })[];
  const ids = [...new Set(rows.map((r) => r.creator_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: ps } = await admin.from("profiles").select("id, anonymous_username").in("id", ids);
    for (const p of ps ?? []) names.set(p.id as string, (p.anonymous_username as string) ?? "anonymous");
  }
  return rows.map(({ creator_id, ...r }) => ({
    ...r,
    age: r.age ?? null,
    like_count: r.like_count ?? 0,
    audience: r.audience ?? "other",
    creator: creator_id ? names.get(creator_id) ?? "anonymous" : "SweetScene",
  }));
}
