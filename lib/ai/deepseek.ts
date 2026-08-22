import "server-only";
import type {
  AIProvider,
  AIMessage,
  AIConfig,
  AIGenerateResult,
} from "@/lib/ai/provider";
import { AI_FETCH_TIMEOUT_MS } from "@/lib/config/constants";
import {
  DEEPSEEK_MODEL,
  DEEPSEEK_GENERATION,
  DEEPSEEK_STOP_SEQUENCES,
} from "@/lib/ai/policy";
import { getSetting, SETTING_KEYS } from "@/lib/config/settings";

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

/* Settings resolve from the admin dashboard first, then the
   environment — so the operator can rotate the provider key without a
   redeploy. See lib/config/settings.ts. */
async function getEndpoint(): Promise<string> {
  return (
    (await getSetting(
      SETTING_KEYS.aiEndpoint,
      process.env.DEEPSEEK_ENDPOINT || undefined
    )) || "https://api.deepseek.com/v1/chat/completions"
  );
}

async function getKey(): Promise<string | undefined> {
  return getSetting(SETTING_KEYS.aiApiKey, process.env.AI_API_KEY);
}

async function getModel(): Promise<string> {
  return (await getSetting(SETTING_KEYS.aiModel, undefined)) || DEEPSEEK_MODEL;
}

const FETCH_TIMEOUT_MS = AI_FETCH_TIMEOUT_MS;

export const deepseekProvider: AIProvider = {
  name: "deepseek",

  async isConfigured(): Promise<boolean> {
    const key = await getKey();
    return typeof key === "string" && key.length > 0;
  },

  estimateTokens(text: string): number {
    return Math.ceil((text ?? "").length / 4);
  },

  async generate(
    messages: AIMessage[],
    config: AIConfig
  ): Promise<AIGenerateResult> {
    const [key, endpoint, model] = await Promise.all([
      getKey(),
      getEndpoint(),
      getModel(),
    ]);
    if (!key) {
      return { error: "AI_API_KEY not configured" };
    }

    /* S7: 30-second timeout via AbortController. */
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        /* Generation defaults live in lib/ai/policy.ts so provider
           tuning is one edit. Per-call config still wins where set.
           frequency/presence penalties counter DeepSeek looping a
           catchphrase across long roleplay; stop sequences keep the
           model from writing the human's next turn. */
        body: JSON.stringify({
          model: config.model ?? model,
          messages,
          max_tokens: config.maxTokens ?? DEEPSEEK_GENERATION.max_tokens,
          temperature: config.temperature ?? DEEPSEEK_GENERATION.temperature,
          top_p: DEEPSEEK_GENERATION.top_p,
          frequency_penalty: DEEPSEEK_GENERATION.frequency_penalty,
          presence_penalty: DEEPSEEK_GENERATION.presence_penalty,
          stop: [...DEEPSEEK_STOP_SEQUENCES],
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