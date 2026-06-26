/**
 * Character card import/export in the Pillowcase / Chara v2 format
 * (the de-facto standard Janitor.ai and SpicyChat both speak). This
 * lets users bring their existing card library into chatty and export
 * chatty-built characters back out — no lock-in.
 *
 * Spec reference (informal): https://github.com/malfoyslastname/character-card-spec-v2
 * We support the fields chatty can actually persist; unknown fields
 * are preserved on import so a round-trip doesn't lose data.
 */

export type CharaCardV2 = {
  spec: "chara_card_v2";
  spec_version: "v2.0";
  data: {
    name: string;
    description: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    alternate_greetings?: string[];
    tags?: string[];
    creator?: string;
    character_book?: unknown;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings_instructions?: string;
    // Preserve any unknown extensions.
    [key: string]: unknown;
  };
};

export type ParsedCharacter = {
  name: string;
  user_prompt: string;
  personality: string[];
  first_message: string | null;
  example_dialog: string | null;
  alternate_greetings: string[];
  scenario_tags: string[];
  is_nsfw: boolean;
};

const MAX_NAME = 50;
const MAX_PROMPT = 2000;
const MAX_ALT = 3;
const MAX_ALT_LEN = 500;

/**
 * Validates and normalises an untrusted JSON object into the chatty
 * internal shape. Refuses oversized fields; trims whitespace; derives
 * SFW/NSFW from `tags` containing "nsfw".
 */
export function importCharacterCard(raw: unknown): ParsedCharacter | { error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { error: "Invalid card: not an object" };
  }

  const card = raw as Partial<CharaCardV2>;
  if (card.spec && card.spec !== "chara_card_v2") {
    /* Be lenient: many v1 cards omit `spec`. Treat missing spec as v1. */
  }

  const data = card.data ?? (raw as Record<string, unknown>);
  const name = String(data.name ?? "").trim();
  if (name.length === 0 || name.length > MAX_NAME) {
    return { error: `Card name required (1-${MAX_NAME} chars)` };
  }

  const description = String(data.description ?? "").trim();
  if (description.length === 0 || description.length > MAX_PROMPT) {
    return { error: `Card description required (1-${MAX_PROMPT} chars)` };
  }

  /* Personality sometimes arrives as a single string ("shy, witty, dominant"),
     sometimes as a comma list, sometimes absent. Normalise to an array. */
  const personalityRaw = data.personality
    ? String(data.personality)
    : "";
  const personality = personalityRaw
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 30)
    .slice(0, 8);

  const firstMessage = data.first_mes
    ? String(data.first_mes).slice(0, 500)
    : null;

  /* `alternate_greetings` may be missing or a non-array. */
  const rawAlts = Array.isArray(data.alternate_greetings)
    ? (data.alternate_greetings as unknown[])
    : [];
  const alternate_greetings: string[] = [];
  for (const g of rawAlts) {
    if (typeof g !== "string") continue;
    if (alternate_greetings.length >= MAX_ALT) break;
    alternate_greetings.push(g.slice(0, MAX_ALT_LEN));
  }

  /* `tags` carry scenario + rating. chatty stores scenario_tags
     separately from personality, so lift tags that look like scenarios. */
  const rawTags = Array.isArray(data.tags) ? (data.tags as unknown[]) : [];
  const knownScenarios = new Set([
    "hospital", "coffee_shop", "mansion", "library", "gym",
    "noir_office", "restaurant", "fitness", "clinic", "home",
    "service", "mystery", "noir", "school", "cafe", "kitchen", "office",
  ]);
  const scenario_tags: string[] = [];
  let is_nsfw = false;
  for (const t of rawTags) {
    if (typeof t !== "string") continue;
    const lower = t.toLowerCase().trim();
    if (lower === "nsfw" || lower === "18+" || lower === "adult") {
      is_nsfw = true;
      continue;
    }
    if (knownScenarios.has(lower) && scenario_tags.length < 5) {
      scenario_tags.push(lower);
    }
  }

  /* Compose the user_prompt from description + personality so the
     wrapped system prompt has something substantive to chew on, even
     when the card's `description` field alone is sparse. */
  const user_prompt =
    [description, personalityRaw ? `Personality: ${personalityRaw}` : ""]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, MAX_PROMPT);

  return {
    name,
    user_prompt,
    personality,
    first_message: firstMessage,
    example_dialog: null,
    alternate_greetings,
    scenario_tags,
    is_nsfw,
  };
}

/**
 * Wraps a chatty character into the Chara v2 format for export.
 * Unknown extras aren't added (we don't store them), but the spec's
 * core fields are populated so Janitor/SpicyChat can import the card.
 */
export function exportCharacterCard(char: {
  name: string;
  user_prompt: string;
  personality: string[];
  first_message: string | null;
  alternate_greetings: string[];
  scenario_tags: string[];
  is_nsfw: boolean;
  creator_id?: string | null;
}): CharaCardV2 {
  const tags = [...char.scenario_tags];
  if (char.is_nsfw) tags.push("nsfw");

  return {
    spec: "chara_card_v2",
    spec_version: "v2.0",
    data: {
      name: char.name,
      description: char.user_prompt,
      personality: char.personality.join(", "),
      first_mes: char.first_message ?? "",
      alternate_greetings: char.alternate_greetings,
      tags,
      creator: "chatty",
      // chatty's system_prompt is the wrapped secret; we DO NOT export it.
      system_prompt: "",
      post_history_instructions: "",
    },
  };
}