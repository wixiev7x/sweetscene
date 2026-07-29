import "server-only";
import type {
  AIProvider,
  AIMessage,
  AIConfig,
  AIGenerateResult,
} from "@/lib/ai/provider";

/**
 * Mock AI provider. Returns a single neutral, in-character line so
 * every app flow — solo play, matched roleplay, image-prompt
 * summarisation — works with zero API keys. The dispatcher in
 * `lib/ai/index.ts` falls back to this provider when the active
 * provider reports `isConfigured() === false`, so dev never crashes
 * before the user has dropped in an `AI_API_KEY`.
 *
 * Phase 8A: all hardcoded archetype lines (maid, nurse, barista,
 * librarian, yoga, chef, detective, trainer) and the roleplay-flavored
 * default pool have been removed per the rebuild spec. The mock now
 * returns a single neutral line that stays usable in any character
 * chat without faking a specific persona.
 */

const NEUTRAL_LINE =
  "The character smiles and waits for you to speak…";

export const mockProvider: AIProvider = {
  name: "mock",

  async isConfigured(): Promise<boolean> {
    return true;
  },

  estimateTokens(text: string): number {
    return Math.ceil((text ?? "").length / 4);
  },

  async generate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _messages: AIMessage[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _config: AIConfig
  ): Promise<AIGenerateResult> {
    /* Simulate brief think time so the "AI is typing…" state is visible. */
    await new Promise((resolve) => setTimeout(resolve, 350));

    return { content: NEUTRAL_LINE };
  },
};