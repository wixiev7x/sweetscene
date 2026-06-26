import "server-only";
import type {
  AIProvider,
  AIMessage,
  AIConfig,
  AIGenerateResult,
} from "@/lib/ai/provider";

/**
 * DeepSeek V3 implementation of the `AIProvider` interface. Uses the
 * `deepseek-chat` model by default. The endpoint URL is centralised here
 * so no other file in the codebase needs to know the vendor's shape.
 *
 * Reads `AI_API_KEY` first, then falls back to the legacy
 * `DEEPSEEK_API_KEY` env var for backward compatibility with the
 * pre-Phase-1 environment.
 */

const DEEPSEEK_ENDPOINT =
  "https://api.deepseek.com/v1/chat/completions";

function getKey(): string | undefined {
  return process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY;
}

export const deepseekProvider: AIProvider = {
  name: "deepseek",

  isConfigured(): boolean {
    const key = getKey();
    return typeof key === "string" && key.length > 0;
  },

  estimateTokens(text: string): number {
    return Math.ceil((text ?? "").length / 4);
  },

  async generate(
    messages: AIMessage[],
    config: AIConfig
  ): Promise<AIGenerateResult> {
    const key = getKey();
    if (!key) {
      return { error: "AI_API_KEY not configured" };
    }

    try {
      const response = await fetch(DEEPSEEK_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model ?? "deepseek-chat",
          messages,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
        }),
      });

      if (!response.ok) {
        return { error: "DeepSeek returned an error" };
      }

      const data = await response.json();
      const content: string | undefined =
        data?.choices?.[0]?.message?.content;

      if (!content) {
        return { error: "DeepSeek returned an empty response" };
      }

      return { content };
    } catch {
      return { error: "DeepSeek request failed" };
    }
  },
};