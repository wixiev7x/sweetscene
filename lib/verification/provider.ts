import "server-only";
import { getVerificationConfig, type VerificationProviderName } from "./config";

/* ════════════════════════════════════════════════════════════════════
 * Age/ID verification — provider adapter.
 *
 * One narrow interface, three eventual implementations. Every
 * implementation FAILS CLOSED until it is actually written against the
 * chosen provider's API. The hosted-flow shape is the same for all
 * three: we hand the user a provider-hosted URL, the provider calls
 * back (webhook) or we poll, and we keep only pass/fail + reference.
 *
 * STATUS: scaffolded, intentionally unimplemented. The operator picks
 * ONE of Persona/Veriff/Yoti and supplies API keys; the concrete
 * adapter is then finished in one place (switch below).
 * ════════════════════════════════════════════════════════════════════ */

export class VerificationNotConfiguredError extends Error {
  constructor() {
    super("No age-verification provider is configured");
  }
}

export type VerificationSession = {
  /** Provider-hosted URL the user is redirected to. */
  redirectUrl: string;
  /** Provider reference for this verification attempt. */
  referenceId: string;
};

export type VerificationOutcome =
  | { status: "verified" }
  | { status: "pending" }
  | { status: "failed"; reason?: string }
  | { status: "expired" };

/**
 * Starts a verification session and returns the hosted-flow URL.
 * Throws VerificationNotConfiguredError until a provider is wired up.
 */
export async function startVerificationSession(params: {
  userId: string;
  returnUrl: string;
}): Promise<VerificationSession> {
  const config = getVerificationConfig();
  if (!config) throw new VerificationNotConfiguredError();
  return startSessionFor(config.provider, params, config.apiKey);
}

/**
 * Asks the provider for the current outcome of a verification attempt.
 * Throws VerificationNotConfiguredError until a provider is wired up.
 */
export async function fetchVerificationOutcome(
  referenceId: string
): Promise<VerificationOutcome> {
  const config = getVerificationConfig();
  if (!config) throw new VerificationNotConfiguredError();
  return fetchOutcomeFor(config.provider, referenceId, config.apiKey);
}

async function startSessionFor(
  provider: VerificationProviderName,
  params: { userId: string; returnUrl: string },
  apiKey: string
): Promise<VerificationSession> {
  switch (provider) {
    case "persona":
    case "veriff":
    case "yoti":
      // TODO(operator): implement against the chosen provider's API.
      // Until then this is an explicit, logged failure — never a
      // silent pass.
      void params;
      void apiKey;
      throw new Error(
        `Age verification provider "${provider}" is not implemented yet — add API keys and finish the adapter in lib/verification/provider.ts`
      );
    default:
      throw new VerificationNotConfiguredError();
  }
}

async function fetchOutcomeFor(
  provider: VerificationProviderName,
  referenceId: string,
  apiKey: string
): Promise<VerificationOutcome> {
  switch (provider) {
    case "persona":
    case "veriff":
    case "yoti":
      void referenceId;
      void apiKey;
      throw new Error(
        `Age verification provider "${provider}" is not implemented yet — add API keys and finish the adapter in lib/verification/provider.ts`
      );
    default:
      throw new VerificationNotConfiguredError();
  }
}
