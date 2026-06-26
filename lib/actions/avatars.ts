"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/ratelimit";

type AvatarResult = { url: string } | { error: string };

/**
 * Generates a tasteful SFW portrait for a character via Pollinations.ai.
 * Even when the character is NSFW, the avatar stays clothed and artistic
 * — the explicit content lives in chat, not the profile picture. This
 * keeps us off image-host content-policy gray areas (locked decision #6)
 * and matches Janitor/SpicyChat's own practice.
 *
 * Returns a Pollinations URL that resolves to the rendered image. The
 * caller stores the URL on `characters.avatar_url`.
 */
export async function generateCharacterAvatar(
  name: string,
  description: string,
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
  const trimmedDesc = (description ?? "").trim();
  if (!trimmedName) return { error: "Name required" };
  if (!trimmedDesc) return { error: "Description required" };

  /* Force SFW framing regardless of the character's chat rating. */
  void isNsfw; // accepted for interface parity; intentionally unused
  const promptText = `tasteful portrait illustration of ${trimmedName}, ${trimmedDesc}, clothed, artistic style, soft cinematic lighting, head-and-shoulders, safe for work, no nudity, no explicit content`;

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