"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/ratelimit";
import { scrubInjection } from "@/lib/utils/safety";
import { getProvider } from "@/lib/ai";

type GenerateImageResult = { imageUrl: string } | { error: string };

/**
 * Generates a romantic scene image from the last 5 chat messages.
 * VIP only. Uses Pollinations.ai with Gemini fallback and a foggy
 * placeholder if both fail.
 */
export async function generateImage(
  matchId: string
): Promise<GenerateImageResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_vip")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_vip) {
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

  const concatenatedMessages = (messages ?? [])
    .map((m) => scrubInjection(m.content))
    .reverse()
    .join("\n");

  let imagePrompt: string;
  try {
    const provider = getProvider();
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
  } catch {
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
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  } catch {
    // Fall through to foggy fallback
  }

  return {
    imageUrl:
      "https://images.unsplash.com/photo-1488861854035-ce89116c420e?w=512&h=512&fit=crop",
  };
}
