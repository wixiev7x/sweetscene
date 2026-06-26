import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Sliding-window rate limiter backed by Upstash Redis when configured.
 * Falls back to an in-memory token bucket (per process) when the
 * Upstash env vars are missing, so the app still works locally and in
 * preview without keys.
 *
 * Phase 5b:
 *   - S3: getClientIp() — extracts the caller's IP from Cloudflare /
 *     X-Forwarded-For headers for IP-based rate limiting.
 *   - S10: the in-memory fallback map is bounded (evicts oldest 50%
 *     when it exceeds 100k entries) to prevent unbounded memory growth.
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
const MEMORY_MAP_MAX = 100_000;

/**
 * Bounds the in-memory map: when it exceeds MEMORY_MAP_MAX entries,
 * evicts the oldest 50%. Closes S10 (unbounded memory leak).
 */
function boundMemoryMap(): void {
  if (memoryHits.size <= MEMORY_MAP_MAX) return;

  /* Sort by key insertion order isn't tracked in a plain Map in
     all engines, so we evict by first-half of the keys array. */
  const keys = Array.from(memoryHits.keys());
  const toEvict = Math.ceil(keys.length / 2);
  for (let i = 0; i < toEvict; i++) {
    memoryHits.delete(keys[i]);
  }
}

function inMemoryLimit(
  identifier: string,
  windowMs: number,
  max: number
): { success: boolean } {
  boundMemoryMap();

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

/**
 * S3: extracts the client IP from request headers. Checks
 * CF-Connecting-IP first (Cloudflare), then X-Forwarded-For (first IP).
 * Returns "unknown" when no IP header is present (e.g. local dev).
 */
export function getClientIp(req: Request): string {
  const headers = req.headers;
  const cfIp = headers.get("CF-Connecting-IP");
  if (cfIp) return cfIp.trim();

  const xff = headers.get("X-Forwarded-For");
  if (xff) {
    const firstIp = xff.split(",")[0];
    if (firstIp) return firstIp.trim();
  }

  return "unknown";
}

/**
 * IP-based rate limiter for brute-force protection (S4). Uses a
 * configurable window and max. Falls back to in-memory when Upstash
 * is not configured.
 */
export async function rateLimitByIp(
  ip: string,
  max: number,
  window: string
): Promise<boolean> {
  const l = getLimiter();
  if (l) {
    const { success } = await l.limit(`ip:${ip}`);
    return success;
  }

  /* Parse the window string (e.g. "5 m") into milliseconds. */
  const match = window.match(/^(\d+)\s*(s|m|h)$/);
  const num = match ? parseInt(match[1], 10) : 5;
  const unit = match?.[2] ?? "m";
  const ms =
    unit === "s" ? num * 1000 : unit === "m" ? num * 60_000 : num * 3_600_000;

  return inMemoryLimit(`ip:${ip}`, ms, max).success;
}