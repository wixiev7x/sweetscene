import "server-only";
import type {
  AIProvider,
  AIMessage,
  AIConfig,
  AIGenerateResult,
} from "@/lib/ai/provider";

/**
 * Mock AI provider. Returns short, character-appropriate canned lines
 * derived from the system prompt so every app flow — solo play, matched
 * roleplay, image-prompt summarisation — works with zero API keys.
 *
 * The dispatcher in `lib/ai/index.ts` falls back to this provider when
 * the active provider reports `isConfigured() === false`, so dev never
 * crashes before the user has dropped in a `AI_API_KEY`.
 *
 * Lines are deliberately generic-but-on-tone: a "maid" system prompt
 * gets a deferential line, a "nurse" gets a teasing one, etc. When no
 * keyword matches, a default flirty narrator line is used so the chat
 * keeps moving.
 */

const LINES_BY_KEYWORD: Array<{ match: RegExp; lines: string[] }> = [
  {
    match: /maid/i,
    lines: [
      "Oh, welcome home! I just finished dusting the study.",
      "Tea is brewing, master. Shall I pour you a cup?",
      "You look tired… sit, please. Let me take care of everything.",
    ],
  },
  {
    match: /nurse/i,
    lines: [
      "Hmm, your heartbeat is quick. Nervous, or just… happy to see me?",
      "Hold still. The doctor is out, so you're stuck with me.",
      "You're not even sick, are you? You just wanted an excuse.",
    ],
  },
  {
    match: /barista/i,
    lines: [
      "Oat milk, no foam, extra shots. I memorised it the day you walked in.",
      "It's slow today. Tell me something interesting while I pull this.",
      "You again? I should start charging you rent on that corner table.",
    ],
  },
  {
    match: /librarian/i,
    lines: [
      "Shh… the good books are in the back. Come with me.",
      "You're loud. I like that. But not here — follow me.",
      "I found a first edition of what you asked for. It's… intimate.",
    ],
  },
  {
    match: /yoga/i,
    lines: [
      "Breathe. Good. Now close your eyes and trust me.",
      "Your form is stiff. Let me adjust you — there.",
      "Stillness is where the work happens. Stay.",
    ],
  },
  {
    match: /chef/i,
    lines: [
      "Taste this. Tell me what it's missing. Be honest.",
      "I saved you the best plate. Don't tell the others.",
      "Cooking for someone changes the food. You changed mine.",
    ],
  },
  {
    match: /detective|noir|mystery/i,
    lines: [
      "Three alibis, two lies, and you. I love those odds.",
      "The evidence is cold. You, on the other hand…",
      "Case closed? Not yet. I have one more question for you.",
    ],
  },
  {
    match: /trainer|gym|fitness/i,
    lines: [
      "Five more. You can hate me after.",
      "Sweat is just weakness leaving the body. Keep going.",
      "You're stronger than yesterday. Show me.",
    ],
  },
];

const DEFAULT_LINES = [
  "The scene hums. Tell me — what do you do next?",
  "I raise an eyebrow, curious. Continue.",
  "Such tension in this room. Don't stop on my account.",
  "The moment stretches. Your move.",
  "I tilt my head, waiting. Well?",
];

/**
 * Increments per-call so consecutive mock responses don't repeat the
 * same line. Module-scoped on purpose — mock is single-process dev only.
 */
let callCounter = 0;

export const mockProvider: AIProvider = {
  name: "mock",

  isConfigured(): boolean {
    return true;
  },

  estimateTokens(text: string): number {
    return Math.ceil((text ?? "").length / 4);
  },

  async generate(
    messages: AIMessage[],
    config: AIConfig
  ): Promise<AIGenerateResult> {
    /* `config` is accepted for interface parity. The mock ignores it; the
       temperature/max_tokens fields have no effect on canned lines. */
    void config;

    /* Find the system prompt — it carries the character description. */
    const systemMessage = messages.find((m) => m.role === "system");
    const systemText = systemMessage?.content ?? "";

    let pool = DEFAULT_LINES;
    for (const entry of LINES_BY_KEYWORD) {
      if (entry.match.test(systemText)) {
        pool = entry.lines;
        break;
      }
    }

    /* Rotate by call counter so repeated turns vary. */
    const line = pool[callCounter % pool.length];
    callCounter++;

    /* Simulate brief think time so the "AI is typing…" state is visible. */
    await new Promise((resolve) => setTimeout(resolve, 350));

    return { content: line };
  },
};