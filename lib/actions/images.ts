"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/ratelimit";
import { sanitizeAndScrub } from "@/lib/utils/safety";
import { decryptMessage } from "@/lib/utils/crypto";
import { getProvider } from "@/lib/ai";
import { getSetting, SETTING_KEYS } from "@/lib/config/settings";
import { logger } from "@/lib/utils/logger";

type GenerateImageResult = { imageUrl: string } | { error: string };

/**
 * Generates a romantic scene image from the last 5 chat messages.
 * VIP only. Uses Pollinations.ai with Gemini fallback and a foggy
 * placeholder if both fail.
 *
 * Phase 5a: VIP check via get_own_profile RPC (B5 — is_vip REVOKED
 * from authenticated direct SELECT). Gemini + Unsplash URLs from env
 * (S2b).
 */
export async function generateImage(
  matchId: string
): Promise<GenerateImageResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  /* B5: read VIP via get_own_profile RPC (is_vip REVOKED from
     authenticated direct SELECT). */
  const { data: profileData } = await supabase.rpc("get_own_profile");
  if (!profileData || !Array.isArray(profileData) || profileData.length === 0) {
    return { error: "Profile not found" };
  }
  const profile = profileData[0] as { is_vip: boolean };

  if (!profile.is_vip) {
    return { error: "VIP only feature" };
  }

  if (!(await rateLimit(user.id))) {
    return { error: "Slow down. The artist is busy." };
  }

  const { data: match } = await supabase
    .from("matches")
    .select("id, user_a, user_b")
    .eq("id", matchId)
    .single();

  if (!match) return { error: "Match not found" };
  if (match.user_a !== user.id && match.user_b !== user.id) {
    return { error: "Match not found" };
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("content")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(5);

  /* E3: decrypt messages before building the image prompt. Messages
      are AES-256-GCM encrypted at rest — without decryption, the prompt
      generator receives base64 ciphertext gibberish, not the scene text. */
  const concatenatedMessages = (messages ?? [])
    .map((m) => {
      try {
        return decryptMessage(m.content as string);
      } catch {
        return "";
      }
    })
    .map((text) => sanitizeAndScrub(text))
    .reverse()
    .join("\n");

  let imagePrompt: string;
  try {
    const provider = await getProvider();
    const dsResult = await provider.generate(
      [
        {
          role: "system",
          content:
            "You are an image prompt generator. Given a chat scene, output a single descriptive image prompt in English. Describe the scene visually: setting, lighting, mood, characters present, poses. Do NOT include explicit sexual terms. Use artistic, tasteful language. Output ONLY the prompt, nothing else. Max 50 words.",
        },
        { role: "user", content: concatenatedMessages },
      ],
      { maxTokens: 100, temperature: 0.7 }
    );

    if ("content" in dsResult) {
      imagePrompt = dsResult.content;
    } else {
      throw new Error("Image prompt generation failed");
    }
  } catch (err) {
    logger.warn("image_prompt_failed", { matchId, err });
    imagePrompt =
      "a dimly lit romantic scene, soft focus, cinematic lighting, foggy atmosphere";
  }

  try {
    const pollinationsUrl = `${
      process.env.POLLINATIONS_API_URL
    }${encodeURIComponent(imagePrompt)}?width=512&height=512&nologo=true`;

    const pollResponse = await fetch(pollinationsUrl);
    if (pollResponse.ok) {
      return { imageUrl: pollinationsUrl };
    }
  } catch {
    // Fall through to Gemini
  }

  try {
    /* S2b: Gemini endpoint from env (with a default for backward compat). */
    const geminiEndpoint = process.env.GEMINI_ENDPOINT || "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    /* Key resolves from the admin dashboard first, then env. */
    const geminiKey = await getSetting(
      SETTING_KEYS.geminiApiKey,
      process.env.GEMINI_API_KEY
    );

    /* Bail rather than sending "?key=undefined" at Google. */
    if (!geminiKey) return { error: "Image generation is not configured" };

    const geminiResponse = await fetch(
      geminiEndpoint,
      {
        method: "POST",
        /* Key travels in a header, not the query string — URLs end up
           in proxy, CDN and access logs; headers generally do not. */
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `Generate an image: ${imagePrompt}` },
              ],
            },
          ],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      }
    );

    if (geminiResponse.ok) {
      const geminiData = await geminiResponse.json();
      const parts: Array<{
        inlineData?: { data: string; mimeType: string };
      }> = geminiData.candidates?.[0]?.content?.parts ?? [];

      for (const part of parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || "image/png";
          return {
            imageUrl: `data:${mimeType};base64,${part.inlineData.data}`,
          };
        }
      }
    }
  } catch (err) {
    /* Every VIP image silently degrading to the stock fallback looks
       identical to the feature working, from the outside. */
    logger.warn("image_generation_failed", { err });
  }

  /* S2b: Unsplash fallback from env. */
  return {
    imageUrl:
      process.env.UNSPLASH_FALLBACK_IMAGE ||
      "https://images.unsplash.com/photo-1488861854035-ce89116c420e?w=512&h=512&fit=crop",
  };
}
