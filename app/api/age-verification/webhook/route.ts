import { NextResponse } from "next/server";
import { isVerificationConfigured } from "@/lib/verification/config";
import { logger } from "@/lib/utils/logger";

/* ════════════════════════════════════════════════════════════════════
 * Age-verification provider webhook (scaffold).
 *
 * Each provider (Persona / Veriff / Yoti) signs its callbacks
 * differently; the concrete verification is implemented together with
 * the chosen provider's adapter in lib/verification/provider.ts.
 *
 * Until then this endpoint:
 *   - rejects everything with 501 (fail closed — nothing is marked
 *     verified by an unverified source),
 *   - logs the attempt so a misconfigured provider is visible,
 *   - is excluded from proxy auth gating (like the NOWPayments IPN)
 *     because provider webhooks carry no SweetScene session.
 *
 * NEVER mark a profile verified here without verifying the provider's
 * signature first — that check IS the authentication for this route.
 * ════════════════════════════════════════════════════════════════════ */

export async function POST(_request: Request): Promise<NextResponse> {
  if (!isVerificationConfigured()) {
    logger.warn("age_verification_webhook_unconfigured", {});
    return NextResponse.json(
      { error: "Age verification is not configured" },
      { status: 501 }
    );
  }

  /* Provider picked but adapter not finished — same fail-closed. */
  logger.warn("age_verification_webhook_not_implemented", {});
  return NextResponse.json(
    { error: "Webhook handler not implemented for the configured provider yet" },
    { status: 501 }
  );
}
