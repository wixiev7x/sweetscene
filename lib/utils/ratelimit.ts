import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Sliding-window rate limiter backed by Upstash Redis when configured.
 * Falls back to an in-memory token bucket (per process) when the
 * Upstash env vars are missing, so the app still works locally and in
 * preview without keys.
 */

let limiter: Ratelimit | null = null;

function getLimiter(): Ratelimit | null {
  if (limiter) return limiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(1, "3 s"),
      analytics: false,
      prefix: "chatty",
    });
    return limiter;
  }

  return null;
}

/* ── in-memory fallback (per server process) ── */
const memoryHits = new Map<string, number[]>();

function inMemoryLimit(
  identifier: string,
  windowMs: number,
  max: number
): { success: boolean } {
  const now = Date.now();
  const hits = (memoryHits.get(identifier) ?? []).filter(
    (t) => now - t < windowMs
  );
  hits.push(now);
  memoryHits.set(identifier, hits);
  return { success: hits.length <= max };
}

/**
 * Enforces a 1-action-per-3-seconds rate limit for `identifier`
 * (typically a user id). Returns `true` if the caller should proceed,
 * `false` if the limit was exceeded.
 */
export async function rateLimit(
  identifier: string
): Promise<boolean> {
  const l = getLimiter();
  if (l) {
    const { success } = await l.limit(identifier);
    return success;
  }
  return inMemoryLimit(identifier, 3000, 1).success;
}