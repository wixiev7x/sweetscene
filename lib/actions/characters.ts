"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/ratelimit";
import { wrapSystemPrompt } from "@/lib/ai/prompts";
import { scrubInjection } from "@/lib/utils/safety";
import { moderateFields } from "@/lib/utils/moderation";
import { validateAvatarUrl } from "@/lib/utils/url";
import { createAdminClient } from "@/lib/supabase/server-admin";
import {
  importCharacterCard,
  exportCharacterCard,
  type ParsedCharacter,
  type CharaCardV2,
} from "@/lib/utils/characterCard";

/* ──────────────────────────────────────────────────────────────────
 * Phase 2 — Character creation parity (Janitor / SpicyChat / Erogen).
 * Full card spec: name, description, personality traits, first message,
 * example dialog, alternate greetings, visibility, avatar, plus
 * scenario tags and a SFW/NSFW chat-mode toggle.
 * ────────────────────────────────────────────────────────────────── */

type Visibility = "private" | "unlisted" | "public";

type CreateCharacterParams = {
  name: string;
  user_prompt: string;
  scenario_tags: string[];
  is_nsfw: boolean;
  is_public: boolean;
  personality?: string[];
  first_message?: string;
  example_dialog?: string;
  alternate_greetings?: string[];
  visibility?: Visibility;
  avatar_url?: string | null;
  /* Phase 8A — new Character.AI-style fields. */
  short_description?: string;
  full_personality?: string;
  backstory?: string;
  tags?: string[];
  category?: "companion" | "roleplay" | "adventure" | "romance" | "assistant" | "other";
};

type CreateCharacterResult = { characterId: string } | { error: string };

const MAX_NAME = 50;
const MAX_PROMPT = 2000;
const MAX_TAGS = 5;
const MAX_PERSONALITY = 8;
const MAX_FIRST_MSG = 500;
const MAX_EXAMPLE = 2000;
const MAX_ALT_GREETINGS = 3;
const MAX_ALT_GREETING_LEN = 500;
/* Phase 8A — new field limits. */
const MAX_SHORT_DESC = 200;
const MAX_FULL_PERSONALITY = 3000;
const MAX_BACKSTORY = 3000;
const MAX_NEW_TAGS = 10;
const VALID_CATEGORIES = [
  "companion",
  "roleplay",
  "adventure",
  "romance",
  "assistant",
  "other",
] as const;

function validateFields(p: CreateCharacterParams): string | null {
  const name = (p.name ?? "").trim();
  if (name.length === 0 || name.length > MAX_NAME) {
    return `Name required (1-${MAX_NAME} chars)`;
  }
  const prompt = (p.user_prompt ?? "").trim();
  if (prompt.length === 0 || prompt.length > MAX_PROMPT) {
    return `Prompt required (1-${MAX_PROMPT} chars)`;
  }
  const tags = p.scenario_tags ?? [];
  if (tags.length < 1 || tags.length > MAX_TAGS) {
    return `Select 1-${MAX_TAGS} scenario tags`;
  }
  const personality = p.personality ?? [];
  if (personality.length > MAX_PERSONALITY) {
    return `Max ${MAX_PERSONALITY} personality traits`;
  }
  if (p.first_message && p.first_message.length > MAX_FIRST_MSG) {
    return `First message max ${MAX_FIRST_MSG} chars`;
  }
  if (p.example_dialog && p.example_dialog.length > MAX_EXAMPLE) {
    return `Example dialog max ${MAX_EXAMPLE} chars`;
  }
  const alts = p.alternate_greetings ?? [];
  if (alts.length > MAX_ALT_GREETINGS) {
    return `Max ${MAX_ALT_GREETINGS} alternate greetings`;
  }
  for (const g of alts) {
    if ((g ?? "").length > MAX_ALT_GREETING_LEN) {
      return `Alternate greeting max ${MAX_ALT_GREETING_LEN} chars`;
    }
  }
  if (
    p.visibility &&
    !["private", "unlisted", "public"].includes(p.visibility)
  ) {
    return "Invalid visibility";
  }
  /* Phase 8A — validate new fields. */
  if (p.short_description && p.short_description.length > MAX_SHORT_DESC) {
    return `Short description max ${MAX_SHORT_DESC} chars`;
  }
  if (p.full_personality && p.full_personality.length > MAX_FULL_PERSONALITY) {
    return `Full personality max ${MAX_FULL_PERSONALITY} chars`;
  }
  if (p.backstory && p.backstory.length > MAX_BACKSTORY) {
    return `Backstory max ${MAX_BACKSTORY} chars`;
  }
  if (p.tags && p.tags.length > MAX_NEW_TAGS) {
    return `Max ${MAX_NEW_TAGS} tags`;
  }
  if (p.category && !VALID_CATEGORIES.includes(p.category)) {
    return "Invalid category";
  }
  return null;
}

/**
 * Every author-supplied free-text field that ends up in the model's
 * context. The character body lands in the SYSTEM role, so this is the
 * highest-trust position in the prompt and must be screened at least as
 * hard as a chat message.
 */
function authoredTextFields(p: {
  name?: string;
  user_prompt?: string;
  first_message?: string | null;
  example_dialog?: string | null;
  short_description?: string | null;
  full_personality?: string | null;
  backstory?: string | null;
  alternate_greetings?: string[] | null;
}): string[] {
  return [
    p.name,
    p.user_prompt,
    p.first_message,
    p.example_dialog,
    p.short_description,
    p.full_personality,
    p.backstory,
    ...(p.alternate_greetings ?? []),
  ].filter((v): v is string => typeof v === "string" && v.length > 0);
}

/**
 * Hard-refuses a character whose authored text trips moderation. The
 * character-card IMPORT path (`lib/utils/characterCard.ts`) already
 * scrubbed and blocked; the manual create/update path did not, so
 * identical text was rejected on import but accepted when typed into
 * the form. Same destination (the system prompt) — same screening.
 *
 * A character prompt is worth screening harder than a chat message. A
 * message is one turn; a prompt is baked into the system prompt of
 * every future scene, and on a public character it is baked into
 * everyone else's too.
 *
 * @param p - The authored fields, merged if this is an edit.
 * @param nsfwAllowed - The character's own NSFW rating. It widens what
 *   counts as acceptable adult content and nothing else: the always
 *   refused categories, sexual/minors among them, ignore it.
 */
async function validateCharacterSafety(
  p: Parameters<typeof authoredTextFields>[0],
  nsfwAllowed: boolean
): Promise<string | null> {
  const verdict = await moderateFields(authoredTextFields(p), {
    nsfwAllowed,
    surface: "character",
  });
  return verdict.allowed
    ? null
    : "This character contains prohibited content and cannot be saved.";
}

/**
 * Creates a new AI character owned by the current user. The user's prompt
 * is secretly wrapped into a system_prompt before being stored (see
 * `lib/ai/prompts.ts`). The wrapped prompt never leaves the server.
 */
export async function createCharacter(
  params: CreateCharacterParams
): Promise<CreateCharacterResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Too many requests. Slow down." };
  }

  /* C3: re-check VIP server-side for NSFW character creation. The
     client gate is bypassable by calling the action directly. */
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
  }

  const validationError = validateFields(params);
  if (validationError) return { error: validationError };

  const safetyError = await validateCharacterSafety(params, params.is_nsfw);
  if (safetyError) return { error: safetyError };

  /* Avatars are rendered in every viewer's browser — an arbitrary host
     would harvest their IP and defeat the platform's anonymity. */
  const avatar = validateAvatarUrl(params.avatar_url);
  if ("error" in avatar) return { error: avatar.error };

  /* `visibility` is the Phase 2 canonical field; `is_public` is kept as
     a legacy bridge for any code path that still reads it. The DB
     trigger `sync_character_visibility` keeps the column in sync. */
  const visibility: Visibility = params.visibility ?? (params.is_public ? "public" : "private");

  /* The body lands in the SYSTEM role, so scrub role-reassignment and
     prompt-extraction patterns out of it before it is ever stored. The
     import path already did this; the manual path did not. */
  const safePrompt = scrubInjection(params.user_prompt.trim());
  const systemPrompt = wrapSystemPrompt(safePrompt, params.is_nsfw);

  try {
    const { data: inserted, error: insertError } = await supabase
      .from("characters")
      .insert({
        creator_id: user.id,
        name: params.name.trim(),
        user_prompt: safePrompt,
        system_prompt: systemPrompt,
        is_public: visibility === "public",
        scenario_tags: params.scenario_tags,
        is_nsfw: params.is_nsfw,
        personality: params.personality ?? [],
        first_message: params.first_message ?? null,
        example_dialog: params.example_dialog ?? null,
        alternate_greetings: params.alternate_greetings ?? [],
        visibility,
        avatar_url: avatar.url,
        /* Phase 8A — new character fields. */
        short_description: params.short_description?.trim() ?? null,
        full_personality: params.full_personality?.trim() ?? null,
        backstory: params.backstory?.trim() ?? null,
        tags: params.tags ?? [],
        category: params.category ?? "other",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return { error: "Failed to create character" };
    }

    return { characterId: inserted.id };
  } catch {
    return { error: "Failed to create character" };
  }
}

type UpdateCharacterPatch = Partial<CreateCharacterParams>;

type UpdateCharacterResult = { characterId: string } | { error: string };

/**
 * Updates a character owned by the current user. RLS already enforces
 * ownership; the action re-verifies for defense-in-depth. Bumping the
 * `version` lets in-flight matches keep their `match_characters_snapshot`
 * unchanged — old scenes are unaffected.
 */
export async function updateCharacter(
  characterId: string,
  patch: UpdateCharacterPatch
): Promise<UpdateCharacterResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Too many requests. Slow down." };
  }

  /* Verify ownership before mutating. */
  const { data: existing } = await supabase
    .from("characters")
    /* name and scenario_tags are read below to backfill an omitted
       patch field. They were missing from this select, so a partial
       update (name unchanged) merged `undefined` into a required field
       and failed validateFields. */
    .select("id, name, system_prompt, user_prompt, is_nsfw, version, scenario_tags")
    .eq("id", characterId)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (!existing) return { error: "Character not found" };

  /* E6: VIP check for NSFW toggle on update. If the patch flips
     is_nsfw to true and the character wasn't already NSFW, the
     caller must be VIP — same gate as createCharacter. */
  if (patch.is_nsfw === true && !(existing.is_nsfw as boolean)) {
    const admin = createAdminClient();
    const { data: profileRow } = (await admin
      .from("profiles")
      .select("is_vip")
      .eq("id", user.id)
      .single()) as { data: { is_vip: boolean } | null };

    if (!profileRow || !profileRow.is_vip) {
      return { error: "NSFW characters require VIP" };
    }
  }

  /* E7: fall back to existing scenario_tags when the patch omits them,
     so partial updates (e.g. name change only) don't fail validation. */
  const existingTags = (existing as Record<string, unknown>).scenario_tags as string[] ?? [];
  const merged: CreateCharacterParams = {
    name: patch.name ?? (existing as Record<string, unknown>).name as string,
    user_prompt: patch.user_prompt ?? (existing as Record<string, unknown>).user_prompt as string,
    scenario_tags: patch.scenario_tags ?? existingTags,
    is_nsfw: patch.is_nsfw ?? (existing.is_nsfw as boolean),
    is_public: patch.is_public ?? false,
    personality: patch.personality,
    first_message: patch.first_message,
    example_dialog: patch.example_dialog,
    alternate_greetings: patch.alternate_greetings,
    visibility: patch.visibility,
    avatar_url: patch.avatar_url,
  };
  const validationError = validateFields(merged);
  if (validationError) return { error: validationError };

  /* Screen the merged result, not just the patch: a two-step edit could
     otherwise assemble prohibited text one field at a time. */
  const safetyError = await validateCharacterSafety(
    { ...merged, ...patch },
    patch.is_nsfw ?? (existing.is_nsfw as boolean)
  );
  if (safetyError) return { error: safetyError };

  /* Same allowlist as the create path — otherwise a character is made
     clean and then edited to point at a tracking host. */
  const avatar =
    patch.avatar_url !== undefined
      ? validateAvatarUrl(patch.avatar_url)
      : null;
  if (avatar && "error" in avatar) return { error: avatar.error };

  /* If the user_prompt or nsfw rating changed, re-wrap the system prompt. */
  const promptChanged =
    patch.user_prompt !== undefined || patch.is_nsfw !== undefined;
  const scrubbedPatchPrompt =
    patch.user_prompt !== undefined
      ? scrubInjection(patch.user_prompt.trim())
      : undefined;
  const newSystemPrompt = promptChanged
    ? wrapSystemPrompt(
        scrubbedPatchPrompt ?? ((existing as Record<string, unknown>).user_prompt as string),
        patch.is_nsfw ?? (existing.is_nsfw as boolean)
      )
    : (existing.system_prompt as string);

/* Only write fields that were supplied in the patch. Avoids clobbering
      arrays with `null` when the client only meant to update the name. */
  const update: Record<string, unknown> = {
    system_prompt: newSystemPrompt,
    version: ((existing.version as number) ?? 1) + (promptChanged ? 1 : 0),
  };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.user_prompt !== undefined) update.user_prompt = scrubbedPatchPrompt;
  if (patch.scenario_tags !== undefined) update.scenario_tags = patch.scenario_tags;
  if (patch.is_nsfw !== undefined) update.is_nsfw = patch.is_nsfw;
  if (patch.personality !== undefined) update.personality = patch.personality;
  if (patch.first_message !== undefined) update.first_message = patch.first_message ?? null;
  if (patch.example_dialog !== undefined) update.example_dialog = patch.example_dialog ?? null;
  if (patch.alternate_greetings !== undefined) update.alternate_greetings = patch.alternate_greetings;
  if (patch.visibility !== undefined) update.visibility = patch.visibility;
  if (avatar && !("error" in avatar)) update.avatar_url = avatar.url;
  /* Phase 8A — new fields. */
  if (patch.short_description !== undefined) update.short_description = patch.short_description?.trim() ?? null;
  if (patch.full_personality !== undefined) update.full_personality = patch.full_personality?.trim() ?? null;
  if (patch.backstory !== undefined) update.backstory = patch.backstory?.trim() ?? null;
  if (patch.tags !== undefined) update.tags = patch.tags;
  if (patch.category !== undefined) update.category = patch.category;

  const { error: updateError } = await supabase
    .from("characters")
    .update(update)
    .eq("id", characterId)
    .eq("creator_id", user.id);

  if (updateError) return { error: "Failed to update character" };

  return { characterId };
}

type DeleteCharacterResult = { success: true } | { error: string };

/**
 * Deletes a character owned by the current user. Refuses if the
 * character is mid-match (active snapshot rows reference it — RLS lets
 * the user see their own snapshots). Deleting the snapshot row is
 * safe: it just freezes the AI behaviour for that scene.
 */
export async function deleteCharacter(
  characterId: string
): Promise<DeleteCharacterResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Too many requests. Slow down." };
  }

  /* `ON DELETE SET NULL` on the snapshot FK means deleting the character
     keeps any in-flight match AI behaviour intact (the snapshot row's
     `system_prompt` column is the source of truth at that point). */
  const { error } = await supabase
    .from("characters")
    .delete()
    .eq("id", characterId)
    .eq("creator_id", user.id);

  if (error) return { error: "Failed to delete character" };
  return { success: true };
}

/* ── Reads ────────────────────────────────────────────────────────
 * NEVER select `system_prompt` for client-facing reads. The wrapped
 * prompt is the platform's secret sauce and must stay server-side.
 * ────────────────────────────────────────────────────────────────── */

export type CharacterPublic = {
  id: string;
  name: string;
  user_prompt: string;
  scenario_tags: string[];
  is_nsfw: boolean;
  personality: string[];
  first_message: string | null;
  example_dialog: string | null;
  alternate_greetings: string[];
  visibility: Visibility;
  avatar_url: string | null;
  connection_score: number;
  creator_id: string | null;
  is_public: boolean;
  /* Phase 8A — new fields. */
  short_description: string | null;
  full_personality: string | null;
  backstory: string | null;
  tags: string[];
  category: string;
  chat_count: number;
};

export type CharacterOwned = CharacterPublic & {
  version: number;
  updated_at: string;
};

const PUBLIC_COLUMNS =
  "id, name, user_prompt, scenario_tags, is_nsfw, personality, first_message, example_dialog, alternate_greetings, visibility, avatar_url, connection_score, creator_id, is_public, short_description, full_personality, backstory, tags, category, chat_count";

const OWNED_COLUMNS = `${PUBLIC_COLUMNS}, version, updated_at`;

type GetCharacterResult = { character: CharacterOwned } | { error: string };

/**
 * Fetches a single character. Returns the full owned shape (incl.
 * `version`) only to the creator; everyone else sees the public columns
 * and only when the character is public/unlisted. Never returns
 * `system_prompt`.
 */
export async function getCharacter(
  characterId: string
): Promise<GetCharacterResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    const { data: row, error } = await supabase
      .from("characters")
      .select(OWNED_COLUMNS)
      .eq("id", characterId)
      .maybeSingle();

    if (error || !row) return { error: "Character not found" };

    const char = row as CharacterOwned;
    const isCreator = char.creator_id === user.id;
    const isDiscoverable =
      char.visibility === "public" || char.visibility === "unlisted";

    if (!isCreator && !isDiscoverable) {
      return { error: "Character not found" };
    }

    /* Non-creators get the trimmed public shape (no `version`/`updated_at`). */
    return {
      character: isCreator
        ? char
        : ({ ...char, version: 1, updated_at: "" } as CharacterOwned),
    };
  } catch {
    return { error: "Character not found" };
  }
}

type GetPublicCharactersResult =
  | { characters: CharacterPublic[] }
  | { error: string };

/**
 * Fetches up to 50 public characters. Optionally filters by personality
 * tag and sorts by popularity (connection_score DESC) or recency.
 */
export async function getPublicCharacters(
  options?: {
    personality?: string;
    sort?: "recent" | "popular";
    nsfw?: "all" | "sfw" | "nsfw";
    /* Phase 8A — new filter dimensions. */
    tag?: string;
    category?: string;
  }
): Promise<GetPublicCharactersResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    let query = supabase
      .from("characters")
      .select(PUBLIC_COLUMNS)
      .eq("is_public", true)
      .limit(50);

    if (options?.personality) {
      query = query.contains("personality", [options.personality]);
    }
    /* Phase 8A — new filters. */
    if (options?.tag) {
      query = query.contains("tags", [options.tag]);
    }
    if (options?.category) {
      query = query.eq("category", options.category);
    }
    if (options?.nsfw === "sfw") query = query.eq("is_nsfw", false);
    if (options?.nsfw === "nsfw") query = query.eq("is_nsfw", true);

    if (options?.sort === "popular") {
      query = query.order("connection_score", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data: rows, error } = await query;

    if (error) return { error: "Failed to fetch characters" };

    return { characters: (rows as CharacterPublic[]) ?? [] };
  } catch {
    return { error: "Failed to fetch characters" };
  }
}

type GetUserCharactersResult =
  | { characters: CharacterOwned[] }
  | { error: string };

/**
 * Fetches every character owned by the current user (any visibility).
 */
export async function getUserCharacters(): Promise<GetUserCharactersResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    const { data: rows, error } = await supabase
      .from("characters")
      .select(OWNED_COLUMNS)
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return { error: "Failed to fetch characters" };

    return { characters: (rows as CharacterOwned[]) ?? [] };
  } catch {
    return { error: "Failed to fetch characters" };
  }
}

/* ── Card import / export (Phase 2.6) ──────────────────────────────
 * Exports the OwnedCharacter rows into the Chara v2 JSON; imports
 * untrusted JSON into a sweetscene character. Round-trips with Janitor /
 * SpicyChat without losing personality or first_message.
 * ────────────────────────────────────────────────────────────────── */

type ExportCardResult = { card: CharaCardV2 } | { error: string };

/**
 * Exports a character the caller owns (or any public/unlisted character)
 * as a Chara v2 card object. Never exports the secret `system_prompt` —
 * the wrapped prompt is platform IP and stays server-side.
 */
export async function exportCharacterCardAction(
  characterId: string
): Promise<ExportCardResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("characters")
    .select(PUBLIC_COLUMNS)
    .eq("id", characterId)
    .maybeSingle();

  if (error || !data) return { error: "Character not found" };

  const char = data as CharacterPublic;
  const isCreator = char.creator_id === user.id;
  const isDiscoverable =
    char.visibility === "public" || char.visibility === "unlisted";
  if (!isCreator && !isDiscoverable) {
    return { error: "Character not found" };
  }

  const card = exportCharacterCard({
    name: char.name,
    user_prompt: char.user_prompt,
    personality: char.personality,
    first_message: char.first_message,
    alternate_greetings: char.alternate_greetings,
    scenario_tags: char.scenario_tags,
    is_nsfw: char.is_nsfw,
  });
  return { card };
}

type ImportCardResult = { characterId: string } | { error: string };

/**
 * Imports an untrusted JSON card into a new sweetscene character owned by
 * the caller. Visibility defaults to `private` so imported cards aren't
 * accidentally published.
 */
export async function importCharacterCardAction(
  raw: unknown
): Promise<ImportCardResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Too many requests. Slow down." };
  }

  const parsed = importCharacterCard(raw);
  if ("error" in parsed) return { error: parsed.error };
  const p: ParsedCharacter = parsed;

  /* If the card carried no scenario tags, drop in `mystery` as a
     neutral default so the character is at least matchable somewhere. */
  const scenarioTags = p.scenario_tags.length > 0 ? p.scenario_tags : ["mystery"];

  return createCharacter({
    name: p.name,
    user_prompt: p.user_prompt,
    scenario_tags: scenarioTags,
    is_nsfw: p.is_nsfw,
    is_public: false,
    personality: p.personality,
    first_message: p.first_message ?? undefined,
    example_dialog: p.example_dialog ?? undefined,
    alternate_greetings: p.alternate_greetings,
    visibility: "private",
    avatar_url: null,
  });
}