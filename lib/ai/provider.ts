/**
 * AI provider abstraction. Every backend the platform supports
 * (DeepSeek, a future dedicated NSFW model, a local test model, …)
 * implements the `AIProvider` interface so the chat/matchmaking/image
 * code never depends on a specific vendor's API shape.
 *
 * To add a new provider (e.g. an NSFW model you choose later):
 *   1. Create `lib/ai/<name>.ts` exporting an object that satisfies
 *      `AIProvider`.
 *   2. Add a `case "<name>":` branch to `lib/ai/index.ts`.
 *   3. Set `AI_PROVIDER=<name>` and `AI_API_KEY=…` in `.env.local`.
 * No other file changes. Chat, matchmaking, image gen, and solo play
 * all keep working untouched.
 */

/** One message in a chat-completion style conversation. */
export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** Tunable parameters passed to the provider on every generation. */
export type AIConfig = {
  maxTokens: number;
  temperature: number;
  /** Optional model override (e.g. "deepseek-chat"). */
  model?: string;
};

/** Successful generation result. */
export type AIGenerateSuccess = { content: string };

/** Failed generation result. Never throws — errors flow as values. */
export type AIGenerateError = { error: string };

export type AIGenerateResult = AIGenerateSuccess | AIGenerateError;

/** Contract every AI backend must satisfy. */
export type AIProvider = {
  /** Human-readable name for logging. */
  readonly name: string;

  /**
   * Returns `true` when the provider has the credentials / local model
   * it needs to actually generate. When `false`, the dispatcher in
   * `lib/ai/index.ts` falls back to the mock provider so dev never
   * crashes and every flow stays demoable.
   */
  isConfigured(): boolean;

  /**
   * Generate a completion. Returns either the text content or an
   * error object — never throws. Callers treat errors as graceful
   * "the character hesitates…" moments, not user-facing exceptions.
   */
  generate(messages: AIMessage[], config: AIConfig): Promise<AIGenerateResult>;

  /**
   * Cheap token estimate used for pool accounting. Doesn't need to
   * be exact — `Math.ceil(text.length / 4)` is fine for English-ish
   * UTF-8 content.
   */
  estimateTokens(text: string): number;
};