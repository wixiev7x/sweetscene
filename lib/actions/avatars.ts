"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/ratelimit";

/* ════════════════════════════════════════════════════════════════════
 * Phase 8A — Character avatar generation.
 *
 * Two paths to an avatar URL:
 *   1. AI-generated: the user writes a free-form prompt (e.g.
 *      "red haired anime girl, green eyes, shy smile"). Pollinations
 *      renders it. A SFW guard clause is prepended so the avatar stays
 *      clothed even for NSFW characters (locked decision #6 — the
 *      explicit content lives in chat, not the pic).
 *   2. User upload: the user uploads to the Supabase Storage `avatars`
 *      bucket from the client and supplies the resulting URL. Phase 12
 *      removed the unused `uploadToStorage` stub — it was a no-op that,
 *      by living in a "use server" file, was published as a public
 *      endpoint for no benefit.
 *
 * Supplied URLs are allowlisted by validateAvatarUrl (lib/utils/url.ts)
 * and by a CHECK constraint on the column: an avatar on an arbitrary
 * host reports every viewer's IP back to whoever set it.
 *
 * No avatar URL is hardcoded. Every value comes from env (Pollinations
 * base URL) or the user's input.
 * ════════════════════════════════════════════════════════════════════ */

type AvatarResult = { url: string } | { error: string };

/**
 * Generates a tasteful SFW portrait for a character via Pollinations.ai.
 * Even when the character is NSFW, the avatar stays clothed and artistic
 * — the explicit content lives in chat, not the profile picture. This
 * keeps us off image-host content-policy gray areas (locked decision #6)
 * and matches Janitor/SpicyChat's own practice.
 *
 * Phase 8A: `avatarPrompt` is now a free-form user-written description
 * (e.g. "red haired anime girl, green eyes, shy smile"). The SFW guard
 * clause is prepended so the user can't trick the generator into
 * explicit avatars.
 */
export async function generateCharacterAvatar(
  name: string,
  avatarPrompt: string,
  isNsfw: boolean
): Promise<AvatarResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down. The artist is busy." };
  }

  const trimmedName = (name ?? "").trim();
  const trimmedPrompt = (avatarPrompt ?? "").trim();
  if (!trimmedName) return { error: "Name required" };
  if (!trimmedPrompt) return { error: "Avatar prompt required" };

  /* Force SFW framing regardless of the character's chat rating. */
  void isNsfw; // accepted for interface parity; intentionally unused for avatar
  const promptText = `tasteful portrait illustration of ${trimmedName}, ${trimmedPrompt}, clothed, artistic style, soft cinematic lighting, head-and-shoulders, safe for work, no nudity, no explicit content`;

  const base = process.env.POLLINATIONS_API_URL;
  if (!base) {
    return { error: "Avatar service not configured" };
  }

  const width = 256;
  const height = 256;
  const url = `${base}${encodeURIComponent(promptText)}?width=${width}&height=${height}&nologo=true&seed=${encodeURIComponent(
    trimmedName
  )}`;

  /* Pollinations returns the image at this URL directly. We don't fetch
     it server-side (would buffer binary through the action); the client
     <img> tag loads it lazily. Validate reachability with a HEAD probe. */
  try {
    const probe = await fetch(url, { method: "HEAD" });
    if (!probe.ok) {
      return { error: "Avatar service unavailable" };
    }
  } catch {
    return { error: "Avatar service unreachable" };
  }

  return { url };
}
