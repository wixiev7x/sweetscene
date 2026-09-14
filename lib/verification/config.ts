import "server-only";

/* ════════════════════════════════════════════════════════════════════
 * Age/ID verification — configuration.
 *
 * A real provider (Persona / Veriff / Yoti) is configured purely via
 * environment variables. Until the operator picks a provider and sets
 * keys, `isVerificationConfigured()` returns false and every gate in
 * the product is INERT — the platform behaves exactly as it did before
 * this existed. Nothing else may branch on provider identity.
 *
 * We store only: pass/fail status + the provider's verification
 * reference ID. ID documents and biometric data never touch our
 * infrastructure (see Privacy Policy §12).
 * ════════════════════════════════════════════════════════════════════ */

export type VerificationProviderName = "persona" | "veriff" | "yoti";

export type VerificationConfig = {
  provider: VerificationProviderName;
  apiKey: string;
  webhookSecret: string;
};

/**
 * Returns the provider configuration, or null when no provider is set
 * up. Env-only by design — these are pre-launch operator keys, not
 * dashboard-rotatable runtime settings.
 */
export function getVerificationConfig(): VerificationConfig | null {
  const provider = process.env.AGE_VERIFICATION_PROVIDER;
  const apiKey = process.env.AGE_VERIFICATION_API_KEY;
  const webhookSecret = process.env.AGE_VERIFICATION_WEBHOOK_SECRET;
  if (!provider || !apiKey || !webhookSecret) return null;
  if (provider !== "persona" && provider !== "veriff" && provider !== "yoti") {
    return null;
  }
  return { provider, apiKey, webhookSecret };
}

export function isVerificationConfigured(): boolean {
  return getVerificationConfig() !== null;
}
