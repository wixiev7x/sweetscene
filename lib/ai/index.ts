import "server-only";
import type { AIProvider } from "@/lib/ai/provider";
import { deepseekProvider } from "@/lib/ai/deepseek";
import { mockProvider } from "@/lib/ai/mock";

/**
 * Returns the active AI provider based on the `AI_PROVIDER` env var
 * (defaulting to `deepseek` for backward compatibility).
 *
 * Fallback chain:
 *   1. If the chosen provider `isConfigured()`, use it.
 *   2. Otherwise, transparently return the mock provider so dev never
 *      crashes before a key is set — every flow stays demoable with
 *      zero API keys.
 *
 * To switch to a future NSFW-specific model: add a `case` here + a
 * matching implementation file, then set `AI_PROVIDER=<name>` and
 * `AI_API_KEY=…` in `.env.local`. Nothing else in the codebase changes.
 */

let cached: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (cached) return cached;

  const requested = process.env.AI_PROVIDER ?? "deepseek";

  let primary: AIProvider;
  switch (requested) {
    case "deepseek":
    default:
      primary = deepseekProvider;
      break;
  }

  /* Mock provider is always available as the safety net. */
  cached = primary.isConfigured() ? primary : mockProvider;
  return cached;
}