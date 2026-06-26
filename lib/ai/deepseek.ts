import "server-only";
import type {
  AIProvider,
  AIMessage,
  AIConfig,
  AIGenerateResult,
} from "@/lib/ai/provider";

/**
 * DeepSeek V3 implementation of the `AIProvider` interface. Uses the
 * `deepseek-chat` model by default. The endpoint URL comes from the
 * `DEEPSEEK_ENDPOINT` env var (S2a) so it's not hardcoded.
 *
 * Phase 5b:
 *   - S2a: endpoint from env (default for backward compat).
 *   - S7: 30-second AbortController timeout on the fetch.
 *   - S13: legacy DEEPSEEK_API_KEY fallback removed — only AI_API_KEY.
 */

function getEndpoint(): string {
  return (
    process.env.DEEPSEEK_ENDPOINT ||
    "https://api.deepseek.com/v1/chat/completions"
  );
}

function getKey(): string | undefined {
  return process.env.AI_API_KEY;
}

const FETCH_TIMEOUT_MS = 30_000;

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

    /* S7: 30-second timeout via AbortController. */
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(getEndpoint(), {
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
        signal: controller.signal,
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
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { error: "DeepSeek request timed out" };
      }
      return { error: "DeepSeek request failed" };
    } finally {
      clearTimeout(timeout);
    }
  },
};