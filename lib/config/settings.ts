import "server-only";
import { createAdminClient } from "@/lib/supabase/server-admin";

/* ════════════════════════════════════════════════════════════════════
 * Phase 12 — Runtime platform settings.
 *
 * Provider credentials live in the `platform_settings` table so the
 * operator can rotate them from the admin dashboard instead of editing
 * environment variables and redeploying.
 *
 * Precedence: database value first, environment variable as fallback.
 * That ordering is deliberate — a key set in the dashboard takes effect
 * within CACHE_TTL_MS, and an untouched install keeps working off
 * .env.local with no database rows at all.
 *
 * ── What deliberately CANNOT be moved here ──────────────────────────
 * Four values must stay in the environment, and moving them into the
 * database would be a security regression, not an improvement:
 *
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *     Circular. These are what authenticate the connection used to READ
 *     this table. There is no bootstrap without them.
 *
 *   MESSAGE_ENCRYPTION_KEY
 *     Storing a decryption key in the same database as the ciphertext
 *     it protects defeats encryption at rest entirely — one database
 *     compromise would yield both halves. It stays in the environment,
 *     held only by the runtime.
 *
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY
 *     Public by design and inlined into the client bundle at build
 *     time, so it cannot be resolved at runtime. (Its private
 *     counterpart, TURNSTILE_SECRET_KEY, IS rotatable here.)
 *
 * SECURITY: every export in this module is server-only and returns raw
 * secret material. Nothing here may be imported by a client component
 * or returned from a server action. The admin UI receives a masked
 * preview from `lib/actions/admin.ts`, never a value.
 * ════════════════════════════════════════════════════════════════════ */

/** Keys recognised in `platform_settings`. */
export const SETTING_KEYS = {
  aiApiKey: "ai_api_key",
  aiEndpoint: "ai_endpoint",
  aiModel: "ai_model",
  geminiApiKey: "gemini_api_key",
  nowpaymentsApiKey: "nowpayments_api_key",
  nowpaymentsIpnSecret: "nowpayments_ipn_secret",
  turnstileSecretKey: "turnstile_secret_key",
  upstashRedisUrl: "upstash_redis_rest_url",
  upstashRedisToken: "upstash_redis_rest_token",
  errorWebhookUrl: "error_webhook_url",
  moderationProvider: "moderation_provider",
  moderationApiKey: "moderation_api_key",
  moderationEndpoint: "moderation_endpoint",
  moderationFailClosed: "moderation_fail_closed",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/**
 * Descriptor for each manageable setting, driving the admin UI. The
 * `env` field names the variable consulted when no row is set, so the
 * dashboard can show operators where a value is currently coming from.
 */
export type SettingDescriptor = {
  key: SettingKey;
  label: string;
  env: string;
  /** Secrets are never echoed back — only a masked preview. */
  secret: boolean;
  hint: string;
};

export const MANAGED_SETTINGS: readonly SettingDescriptor[] = [
  {
    key: SETTING_KEYS.aiApiKey,
    label: "AI API key",
    env: "AI_API_KEY",
    secret: true,
    hint: "DeepSeek API key used for every character reply.",
  },
  {
    key: SETTING_KEYS.aiEndpoint,
    label: "AI endpoint",
    env: "DEEPSEEK_ENDPOINT",
    secret: false,
    hint: "Override the chat-completions URL. Leave blank for DeepSeek's default.",
  },
  {
    key: SETTING_KEYS.aiModel,
    label: "AI model",
    env: "—",
    secret: false,
    hint: "Model name, e.g. deepseek-chat. Blank uses the built-in default.",
  },
  {
    key: SETTING_KEYS.geminiApiKey,
    label: "Gemini API key",
    env: "GEMINI_API_KEY",
    secret: true,
    hint: "Optional. Used for image generation.",
  },
  {
    key: SETTING_KEYS.nowpaymentsApiKey,
    label: "NOWPayments API key",
    env: "NOWPAYMENTS_API_KEY",
    secret: true,
    hint: "Creates invoices. Without it, purchases fail.",
  },
  {
    key: SETTING_KEYS.nowpaymentsIpnSecret,
    label: "NOWPayments IPN secret",
    env: "NOWPAYMENTS_IPN_SECRET",
    secret: true,
    hint: "Verifies payment webhooks. Must match the value in your NOWPayments dashboard.",
  },
  {
    key: SETTING_KEYS.turnstileSecretKey,
    label: "Turnstile secret key",
    env: "TURNSTILE_SECRET_KEY",
    secret: true,
    hint: "Server-side captcha verification. The public site key stays an env var.",
  },
  {
    key: SETTING_KEYS.upstashRedisUrl,
    label: "Upstash Redis URL",
    env: "UPSTASH_REDIS_REST_URL",
    secret: false,
    hint: "Distributed rate limiting. Blank falls back to in-memory limiting.",
  },
  {
    key: SETTING_KEYS.upstashRedisToken,
    label: "Upstash Redis token",
    env: "UPSTASH_REDIS_REST_TOKEN",
    secret: true,
    hint: "Paired with the Upstash URL above.",
  },
  {
    key: SETTING_KEYS.errorWebhookUrl,
    label: "Error webhook URL",
    env: "ERROR_WEBHOOK_URL",
    secret: true,
    hint: "Server errors POST here as JSON. A Discord or Slack incoming webhook works as-is. Blank means errors only reach the platform logs.",
  },
  {
    key: SETTING_KEYS.moderationProvider,
    label: "Moderation provider",
    env: "MODERATION_PROVIDER",
    secret: false,
    hint: "openai, webhook, or none. The blocked-term floor always runs; this adds a classifier that catches paraphrase.",
  },
  {
    key: SETTING_KEYS.moderationApiKey,
    label: "Moderation API key",
    env: "MODERATION_API_KEY",
    secret: true,
    hint: "OpenAI key for the moderations endpoint (it is free and needs no paid credit), or a bearer token for your webhook.",
  },
  {
    key: SETTING_KEYS.moderationEndpoint,
    label: "Moderation endpoint",
    env: "MODERATION_ENDPOINT",
    secret: false,
    hint: "Required for the webhook provider. Optional override of OpenAI's URL.",
  },
  {
    key: SETTING_KEYS.moderationFailClosed,
    label: "Moderation fails closed",
    env: "MODERATION_FAIL_CLOSED",
    secret: false,
    hint: "true blocks messages when the classifier is unreachable. Default false — an outage at the provider should not take chat down, and the blocked-term floor still applies.",
  },
] as const;

/**
 * Cache TTL. Short enough that a rotated key takes effect quickly, long
 * enough that a busy chat endpoint isn't querying settings on every
 * single generation.
 */
const CACHE_TTL_MS = 30_000;

type CacheEntry = { value: string | null; expires: number };

/* Module-scoped, so it is per-server-instance and dies with the
   process. Serverless cold starts simply repopulate it. */
const cache = new Map<string, CacheEntry>();

/**
 * Reads one setting, preferring the database value and falling back to
 * the supplied environment value.
 *
 * Never throws: a settings-table failure must degrade to the env var
 * rather than take the whole platform down.
 *
 * @param key - The setting key to read.
 * @param envFallback - Value to use when no database row is set.
 * @returns The effective value, or undefined if neither source has one.
 */
export async function getSetting(
  key: SettingKey,
  envFallback: string | undefined
): Promise<string | undefined> {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value ?? envFallback;
  }

  let value: string | null = null;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    const raw = (data as { value?: string | null } | null)?.value;
    value = raw && raw.trim() ? raw.trim() : null;
  } catch {
    /* Table missing or service role unavailable — fall back to env. */
    value = null;
  }

  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });

  return value ?? envFallback;
}

/**
 * Drops the cached value for a key so the next read hits the database.
 * Called by the admin action after a write, so a rotation is visible
 * immediately on the instance that performed it. Other instances pick
 * it up within CACHE_TTL_MS.
 */
export function invalidateSetting(key: SettingKey): void {
  cache.delete(key);
}

/**
 * Masks a secret for display. Shows enough to identify which key is
 * installed without disclosing it.
 *
 * @param value - The raw secret, or null.
 * @returns e.g. "sk-1a…9f4c (44 chars)", or null when unset.
 */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 10) {
    return `${"•".repeat(value.length)} (${value.length} chars)`;
  }
  return `${value.slice(0, 5)}…${value.slice(-4)} (${value.length} chars)`;
}
