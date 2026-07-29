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

/**
 * The resolved choice is cached with a TTL rather than for the process
 * lifetime. Credentials can now be set from the admin dashboard at
 * runtime, and an unbounded cache meant an instance that started with
 * no key stayed pinned to the mock provider forever — the operator
 * would paste a valid key and watch the platform keep emitting canned
 * mock replies until the next deploy.
 */
const CACHE_TTL_MS = 30_000;

let cached: AIProvider | null = null;
let cachedAt = 0;

export async function getProvider(): Promise<AIProvider> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  const requested = process.env.AI_PROVIDER ?? "deepseek";

  let primary: AIProvider;
  switch (requested) {
    case "deepseek":
    default:
      primary = deepseekProvider;
      break;
  }

  /* Mock provider is always available as the safety net. */
  cached = (await primary.isConfigured()) ? primary : mockProvider;
  cachedAt = Date.now();
  return cached;
}