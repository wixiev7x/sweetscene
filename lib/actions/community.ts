"use server";

import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { rateLimit, rateLimitByIp } from "@/lib/utils/ratelimit";
import { moderateText } from "@/lib/utils/moderation";
import { scrubInjection } from "@/lib/utils/safety";
import { validateAvatarUrl } from "@/lib/utils/url";
import { isNsfwAccessAllowed } from "@/lib/verification/gate";
import { logger } from "@/lib/utils/logger";

/* ════════════════════════════════════════════════════════════════════
 * Community server actions — bots, confessions, bounties.
 *
 * These three flows previously inserted straight from the browser
 * (RLS-only protection), which meant direct REST calls skipped
 * moderation entirely. Every write now goes through here: identity
 * from the session (or IP for anonymous confessions), rate limited,
 * moderated, injection-scrubbed, then inserted through the user client
 * so RLS still applies on top.
 *
 * NOTE: direct REST inserts against these tables remain possible for
 * anyone holding a valid session until the INSERT policies are
 * tightened at the database level — flagged for the operator in the
 * migration notes; the moderated path is now the app's only path.
 * ════════════════════════════════════════════════════════════════════ */

/* ── Bots (community hosts, /create) ──────────────────────────────── */

export type BotParams = {
  name: string;
  tagline: string;
  personality: string;
  opening_line: string;
  is_nsfw: boolean;
  gender: string | null;
  genres: string[];
  styles: string[];
  image_url: string | null;
};

const cleanTagList = (list: string[] | undefined): string[] =>
  (list ?? [])
    .map((t) => String(t).trim().slice(0, 30))
    .filter(Boolean)
    .slice(0, 5);

export async function createBot(
  params: BotParams
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Log in to publish a character" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down — too many creations." };
  }

  const name = params.name.trim().slice(0, 40);
  const tagline = params.tagline.trim().slice(0, 120);
  const personality = params.personality.trim().slice(0, 2000);
  const opening = params.opening_line.trim().slice(0, 500);
  const genres = cleanTagList(params.genres);
  const styles = cleanTagList(params.styles);
  const gender =
    params.gender === "female" || params.gender === "male" || params.gender === "other"
      ? params.gender
      : null;

  if (name.length < 2) return { error: "Name must be at least 2 characters" };
  if (!personality) return { error: "Personality is required" };
  if (params.is_nsfw && !opening) {
    return { error: "NSFW characters need an opening line" };
  }

  /* Artwork must pass the same URL allowlist as avatars. */
  if (params.image_url && !validateAvatarUrl(params.image_url)) {
    return { error: "Artwork URL not allowed" };
  }

  /* NSFW host creation: same server-side gate as characters — VIP +
     adult-confirmed account (+ ID verification once configured). */
  if (params.is_nsfw) {
    const admin = createAdminClient();
    const { data: profileRow } = (await admin
      .from("profiles")
      .select("is_vip")
      .eq("id", user.id)
      .single()) as { data: { is_vip: boolean } | null };
    if (!profileRow || !profileRow.is_vip) {
      return { error: "NSFW characters require VIP" };
    }
    const nsfw = await isNsfwAccessAllowed(user.id);
    if (!nsfw.allowed) {
      return {
        error:
          nsfw.reason === "unverified"
            ? "NSFW characters require age verification — verify from your profile."
            : "NSFW characters require an adult account.",
      };
    }
  }

  /* Moderation over everything user-authored. */
  const verdict = await moderateText(
    `${name}\n${tagline}\n${personality}\n${opening}`,
    { nsfwAllowed: params.is_nsfw, surface: "bot_create" }
  );
  if (!verdict.allowed) return { error: verdict.reason };

  const { error } = await supabase.from("bots").insert({
    name,
    tagline,
    personality: scrubInjection(personality),
    opening_line: scrubInjection(opening),
    is_nsfw: params.is_nsfw,
    gender,
    genres,
    styles,
    image_url: params.image_url ?? null,
  });
  if (error) {
    logger.error("bot_create_failed", { userId: user.id, error });
    return { error: "Couldn't publish the character — try again" };
  }

  logger.info("bot_created", { userId: user.id, isNsfw: params.is_nsfw, genreCount: genres.length });
  return { ok: true };
}

/* ── Confessions (anonymous wall) ─────────────────────────────────── */

export type ConfessionRow = {
  id: string;
  text: string;
  mood: string | null;
  likes: number;
  created_at: string;
};

const MOODS = new Set(["Heartwarming", "Funny", "Awkward", "Spicy", "Melancholic"]);

export async function postConfession(
  rawText: string,
  mood: string | null
): Promise<{ confession: ConfessionRow } | { error: string }> {
  const supabase = await createClient();

  /* Anonymous by design — signed-out posts are allowed, so the rate
     limit keys on the session when present and the IP otherwise. */
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    if (!(await rateLimit(user.id))) {
      return { error: "Slow down — the wall needs a breath." };
    }
  } else {
    const headerList = await headers();
    const req = new Request("https://internal/confession-limit", { headers: headerList });
    const { getClientIp } = await import("@/lib/utils/ratelimit");
    const ip = getClientIp(req);
    if (!(await rateLimitByIp(ip, 5, "10 m"))) {
      return { error: "Too many posts from this network — try again later." };
    }
  }

  const text = rawText.trim().slice(0, 500);
  if (!text) return { error: "Write something first" };
  const safeMood = mood && MOODS.has(mood) ? mood : "Heartwarming";

  /* Public wall — SFW only, always. */
  const verdict = await moderateText(text, { nsfwAllowed: false, surface: "confession" });
  if (!verdict.allowed) return { error: verdict.reason };

  const { data, error } = await supabase
    .from("confessions")
    .insert({ text: scrubInjection(text), mood: safeMood, likes: 0 })
    .select("id, text, mood, likes, created_at")
    .single();

  if (error || !data) {
    logger.error("confession_post_failed", { userId: user?.id ?? "anon", error });
    return { error: "Could not post your story — try again" };
  }

  logger.info("confession_posted", { userId: user?.id ?? "anon", mood: safeMood });
  return { confession: data as unknown as ConfessionRow };
}

/* ── Bounties (scene requests) ────────────────────────────────────── */

export type BountyRow = {
  id: string;
  anonymous_author: string | null;
  text: string;
  tags: string[];
  responses: number;
  created_at: string;
};

export async function postBounty(
  rawText: string,
  rawTags: string
): Promise<{ bounty: BountyRow } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Log in to post a bounty" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down — too many bounties." };
  }

  const text = rawText.trim().slice(0, 500);
  if (!text) return { error: "Describe the scene you're looking for" };
  const tags = cleanTagList(rawTags.split(","));

  /* Public board — SFW only, always. */
  const verdict = await moderateText(
    `${text}\n${tags.join(", ")}`,
    { nsfwAllowed: false, surface: "bounty" }
  );
  if (!verdict.allowed) return { error: verdict.reason };

  const { data, error } = await supabase
    .from("bounties")
    .insert({ text: scrubInjection(text), tags, responses: 0 })
    .select("id, anonymous_author, text, tags, responses, created_at")
    .single();

  if (error || !data) {
    logger.error("bounty_post_failed", { userId: user.id, error });
    return { error: "Could not post the bounty — try again" };
  }

  logger.info("bounty_posted", { userId: user.id, tagCount: tags.length });
  return { bounty: data as unknown as BountyRow };
}
