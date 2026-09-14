import "server-only";
import { logger } from "@/lib/utils/logger";

/* ════════════════════════════════════════════════════════════════════
 * Honeytokens (canary credentials).
 *
 * Every value below is FAKE by design and published on purpose — they
 * fill the decoy env files (.env.example, .env.staging) that secret
 * scrapers harvest from repositories. They grant nothing anywhere.
 *
 * The one thing they do: if any of these values ever shows up in an
 * inbound request — a webhook signature, an Authorization header, an
 * API call — that means someone is trying to USE credentials they
 * scraped or guessed. The attempt is logged as a CRITICAL alert (which
 * also fires the error webhook) and rejected.
 *
 * Detection list sources, in order:
 *   1. process.env.CANARY_TOKENS — "name:value,name:value,…" set in
 *      Vercel (authoritative, rotatable without a deploy)
 *   2. the embedded list below (covers local dev and unset envs)
 *
 * If this repository is ever made public, rotate the env-var list and
 * treat the embedded list as compromised bait.
 * ════════════════════════════════════════════════════════════════════ */

const EMBEDDED_CANARIES: Record<string, string> = {
  canary_supabase_service_key:
    "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJpc3MiOiAic3VwYWJhc2UiLCAicmVmIjogImM0bjRyeS0wMDAwMDAwMCIsICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpYXQiOiAxNzg1OTU3MTYyLCAiZXhwIjogMjEwMTUzMzE2Mn0.ZGNhbnFzdGFlbGtjYmVnbmRzZmQ",
  canary_supabase_anon_key:
    "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJpc3MiOiAic3VwYWJhc2UiLCAicmVmIjogImM0bjRyeS0wMDAwMDAwMCIsICJyb2xlIjogImFub24iLCAiaWF0IjogMTc4NTk1NzE2MiwgImV4cCI6IDIxMDE1MzMxNjJ9.YW5vbmNhbmFyeXRva2Vu",
  canary_nowpayments_ipn_secret:
    "e5b413b76ba245a9e6de33de7635f19c1eafcb13fbd2904a51c2ef9d3d7841b3",
  canary_nowpayments_api_key:
    "3F34110522F3DFE50C396A3375CE8911A6B7D4E2F8C9031B5A6E7F2-SANDBOX-CANARY",
  canary_deepseek_api_key:
    "sk-0173c74c688f6913e6b1e3a0c9d2f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8",
  canary_gemini_api_key:
    "AIzaV5F1sgNNV29vGhc-fVAGbu-Z012canary34567890",
  canary_turnstile_secret:
    "0x0BB5394667866E00C9B6722575_CE_CANARY_9F2A41",
  canary_message_encryption_key:
    "d2001b4adbc2e3e4ceddfe9c5c15f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4",
  canary_age_verification_key:
    "verif_442d36470cbccf24f106487e3f0b52d3a9c8e7f6g5h4i3j2k1",
  canary_age_verification_webhook_secret:
    "agever_canary_7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a",
  canary_settings_master_key:
    "f1e2d3c4b5a697886970615243f4e5d6c7b8a9canary000102030405",
  canary_upstash_token:
    "AX_canary_UPSTASH_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
  canary_moderation_api_key:
    "sk-canary-moderation-4f5e6d7c8b9a0z1y2x3w4v5u6t",
  canary_error_webhook:
    "https://webhook.site/canary-3fa9c2e1b7d84016",
};

function loadCanaries(): Record<string, string> {
  const merged: Record<string, string> = { ...EMBEDDED_CANARIES };
  const envList = process.env.CANARY_TOKENS;
  if (envList) {
    for (const pair of envList.split(",")) {
      const idx = pair.indexOf(":");
      if (idx > 0) merged[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
  }
  return merged;
}

/**
 * Scans a piece of inbound text (header, body, query) for any canary
 * value. Returns the canary's name on a hit, null otherwise.
 */
export function findCanary(
  ...texts: Array<string | null | undefined>
): string | null {
  const canaries = loadCanaries();
  const values = Object.values(canaries);
  for (const text of texts) {
    if (!text || text.length < 20) continue;
    for (const value of values) {
      if (text.includes(value)) {
        // reverse-lookup the name
        for (const [name, v] of Object.entries(canaries)) {
          if (v === value) return name;
        }
      }
    }
  }
  return null;
}

/**
 * Reports a canary hit as a CRITICAL alert. Never throws.
 */
export function reportCanaryHit(
  name: string,
  context: Record<string, unknown>
): void {
  logger.error("CANARY_CREDENTIAL_USED", {
    canary: name,
    ...context,
    note: "A published fake credential was used against us — someone is replaying scraped/guessed keys. Treat as an active attack and rotate the related real secret.",
  });
}

/* ── Brute-force guard for signature-verified webhooks ──────────────
 *
 * In-memory per-instance counter of invalid-signature attempts per IP.
 * Imperfect across serverless instances, but free, instant, and it
 * stops a single-source hammering of the webhook (the only surface
 * where guessing a secret has a payoff). Upstash can replace it later.
 */

const MAX_INVALID_SIGNATURES = 20;
const WINDOW_MS = 5 * 60 * 1000;

const invalidSignatureCounts = new Map<string, { count: number; resetAt: number }>();

export function recordInvalidSignature(ip: string): { blocked: boolean } {
  const now = Date.now();
  const entry = invalidSignatureCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    invalidSignatureCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { blocked: false };
  }
  entry.count += 1;
  if (entry.count === MAX_INVALID_SIGNATURES) {
    logger.error("webhook_signature_bruteforce", {
      ip,
      attempts: entry.count,
      window: "5m",
      note: "IP throttled after repeated invalid webhook signatures.",
    });
  }
  return { blocked: entry.count >= MAX_INVALID_SIGNATURES };
}

export function isSignatureBruteforceBlocked(ip: string): boolean {
  const entry = invalidSignatureCounts.get(ip);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    invalidSignatureCounts.delete(ip);
    return false;
  }
  return entry.count >= MAX_INVALID_SIGNATURES;
}
