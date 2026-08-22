import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isIP } from "node:net";
import { getSetting, SETTING_KEYS } from "@/lib/config/settings";

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
 *
 * Full-project fix (B3): The old code created a single Upstash
 * Ratelimit with a hardcoded slidingWindow(1, "3 s") and ignored
 * the max/window parameters passed to rateLimitByIp. This meant
 * production (Upstash) was 20× more permissive than dev. Now we
 * create separate Ratelimit instances per (max, window) policy,
 * cached in a Map so identical policies reuse the same instance.
 */

/** Redis client singleton (created once when Upstash is configured). */
let redis: Redis | null = null;

/** Cache of Ratelimit instances keyed by `${max}:${window}` policy. */
const upstashLimiters = new Map<string, Ratelimit>();

/** Default rate-limit policy: 1 action per 3 seconds. */
const DEFAULT_MAX = 1;
const DEFAULT_WINDOW = "3 s";

/**
 * Upstash credentials resolve through the admin dashboard first, then
 * the environment. Async so a dashboard-set value works without a
 * redeploy — see lib/config/settings.ts.
 */
async function getRedis(): Promise<Redis | null> {
  if (redis) return redis;

  const [url, token] = await Promise.all([
    getSetting(SETTING_KEYS.upstashRedisUrl, process.env.UPSTASH_REDIS_REST_URL),
    getSetting(
      SETTING_KEYS.upstashRedisToken,
      process.env.UPSTASH_REDIS_REST_TOKEN
    ),
  ]);

  if (url && token) {
    redis = new Redis({ url, token });
    return redis;
  }
  return null;
}

/**
 * Returns (or creates) a Ratelimit instance for the given policy.
 * Each unique (max, window) pair gets its own Ratelimit so that
 * different rate-limit needs (e.g. 1/3s for actions, 5/5m for auth)
 * are enforced correctly in production with Upstash.
 */
async function getUpstashLimiter(
  max: number,
  window: string
): Promise<Ratelimit | null> {
  const r = await getRedis();
  if (!r) return null;

  const key = `${max}:${window}`;
  let limiter = upstashLimiters.get(key);
  if (limiter) return limiter;

  limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(max, window as never),
    analytics: false,
    prefix: `sweetscene:${key}`,
  });
  upstashLimiters.set(key, limiter);
  return limiter;
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
  const l = await getUpstashLimiter(DEFAULT_MAX, DEFAULT_WINDOW);
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

  /* Cloudflare's CF-Connecting-IP is set by the edge and is not
     client-controllable when Cloudflare is in front. */
  const cfIp = headers.get("CF-Connecting-IP");
  if (cfIp && isIP(cfIp.trim())) return cfIp.trim();

  /* X-Forwarded-For: only trust the first (leftmost) entry — that's
     the client. Validate it's a real IP; reject malformed values. */
  const xff = headers.get("X-Forwarded-For");
  if (xff) {
    const firstIp = xff.split(",")[0]?.trim();
    if (firstIp && isIP(firstIp)) return firstIp;
  }

  return "unknown";
}

/**
 * IP-based rate limiter for brute-force protection (S4). Uses a
 * configurable window and max. Falls back to in-memory when Upstash
 * is not configured. (B3 fix: now honors max/window in Upstash path.)
 */
export async function rateLimitByIp(
  ip: string,
  max: number,
  window: string
): Promise<boolean> {
  const l = await getUpstashLimiter(max, window);
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