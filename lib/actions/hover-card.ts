"use server";

import { createAdminClient } from "@/lib/supabase/server-admin";
import { createClient } from "@/lib/supabase/server";
import { moderateText } from "@/lib/utils/moderation";
import { sanitizeHoverCard, type HoverCard } from "@/lib/hover-card/schema";

const UUID = /^[0-9a-f-]{36}$/i;

function allText(card: HoverCard): string {
  return card.blocks
    .map((b) => {
      switch (b.type) {
        case "heading":
        case "text":
        case "quote":
          return b.text;
        case "list":
        case "tags":
          return b.items.join(" ");
        case "stat":
          return `${b.label} ${b.value}`;
        case "link":
          return b.label;
        default:
          return "";
      }
    })
    .join("\n");
}

/** Creator-only. Validates, moderates, then stores (or clears with null). */
export async function saveHoverCard(characterId: string, input: unknown): Promise<{ ok: true } | { error: string }> {
  if (typeof characterId !== "string" || !UUID.test(characterId)) return { error: "Invalid character" };
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return { error: "Sign in first" };

  const admin = createAdminClient();
  const { data: c } = await admin.from("characters").select("creator_id, is_nsfw").eq("id", characterId).maybeSingle();
  if (!c || c.creator_id !== user.id) return { error: "Only the creator can edit this" };

  if (input === null) {
    const { error } = await admin.from("characters").update({ hover_card: null }).eq("id", characterId);
    return error ? { error: "Couldn't save" } : { ok: true };
  }

  const r = sanitizeHoverCard(input);
  if ("error" in r) return r;
  const text = allText(r.card);
  if (text) {
    const verdict = await moderateText(text, { surface: "hover_card", nsfwAllowed: !!c.is_nsfw });
    if (!verdict.allowed) return { error: "Some of that text can't be posted" };
  }
  const { error } = await admin.from("characters").update({ hover_card: r.card }).eq("id", characterId);
  return error ? { error: "Couldn't save" } : { ok: true };
}

/** Signed-in visitors' preview preference (guests use localStorage). */
export async function saveHoverMode(mode: string): Promise<{ ok: true } | { error: string }> {
  if (!["custom", "story", "greeting", "off"].includes(mode)) return { error: "Invalid" };
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return { ok: true };
  const { error } = await createAdminClient().from("profiles").update({ hover_mode: mode }).eq("id", user.id);
  return error ? { error: "Couldn't save" } : { ok: true };
}
