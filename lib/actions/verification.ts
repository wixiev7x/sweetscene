"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { logger } from "@/lib/utils/logger";
import {
  startVerificationSession,
  fetchVerificationOutcome,
  VerificationNotConfiguredError,
} from "@/lib/verification/provider";
import { isVerificationConfigured } from "@/lib/verification/config";

/* ════════════════════════════════════════════════════════════════════
 * Age verification server actions.
 *
 * Identity is re-derived from the session in every action (LOVABLE
 * rule — no userId parameters). We store only the provider's
 * pass/fail + reference ID on the profile; documents and biometric
 * data stay with the provider.
 * ════════════════════════════════════════════════════════════════════ */

export type MyVerificationStatus =
  | {
      configured: false;
    }
  | {
      configured: true;
      status: string;
      verified: boolean;
    };

/** Reads the caller's verification status for the UI. */
export async function getMyVerificationStatus(): Promise<
  MyVerificationStatus | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!isVerificationConfigured()) {
    return { configured: false };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("age_verified, age_verification_status")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    /* Migration not run yet — report unverified rather than lying. */
    return { configured: true, status: "unavailable", verified: false };
  }
  const row = data as { age_verified: boolean | null; age_verification_status: string | null };
  return {
    configured: true,
    status: row.age_verification_status ?? "unverified",
    verified: row.age_verified === true,
  };
}

/**
 * Starts a verification session and returns the provider's hosted-flow
 * URL. Marks the profile 'pending' and stores the provider reference.
 */
export async function startAgeVerification(): Promise<
  { redirectUrl: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!isVerificationConfigured()) {
    return {
      error:
        "Age verification isn't set up on this platform yet. Contact support if you need it.",
    };
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sweetscene.love";
  let session: Awaited<ReturnType<typeof startVerificationSession>>;
  try {
    session = await startVerificationSession({
      userId: user.id,
      returnUrl: `${origin}/age-verification`,
    });
  } catch (err) {
    if (err instanceof VerificationNotConfiguredError) {
      return { error: "Age verification isn't configured yet." };
    }
    logger.error("age_verification_start_failed", { userId: user.id, err });
    return {
      error:
        "Couldn't start verification right now — try again in a moment, or contact support.",
    };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      age_verification_status: "pending",
      age_verification_id: session.referenceId,
    })
    .eq("id", user.id);

  if (updateError) {
    logger.error("age_verification_status_write_failed", {
      userId: user.id,
      updateError,
    });
    return { error: "Couldn't record the verification attempt — try again." };
  }

  logger.info("age_verification_started", {
    userId: user.id,
    referenceId: session.referenceId,
  });
  return { redirectUrl: session.redirectUrl };
}

/**
 * Polls the provider for the outcome of the pending attempt and
 * updates the profile. Also the path a returning user hits after the
 * hosted flow redirects back.
 */
export async function pollAgeVerificationOutcome(): Promise<
  MyVerificationStatus | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!isVerificationConfigured()) {
    return { configured: false };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("age_verification_id, age_verification_status, age_verified")
    .eq("id", user.id)
    .maybeSingle();

  const row = data as
    | {
        age_verification_id: string | null;
        age_verification_status: string | null;
        age_verified: boolean | null;
      }
    | null;

  if (!row || !row.age_verification_id) {
    return { configured: true, status: "unverified", verified: false };
  }
  if (row.age_verified === true) {
    return { configured: true, status: "verified", verified: true };
  }

  let outcome: Awaited<ReturnType<typeof fetchVerificationOutcome>>;
  try {
    outcome = await fetchVerificationOutcome(row.age_verification_id);
  } catch (err) {
    if (err instanceof VerificationNotConfiguredError) {
      return { configured: false };
    }
    logger.error("age_verification_poll_failed", {
      userId: user.id,
      referenceId: row.age_verification_id,
      err,
    });
    return {
      error:
        "Couldn't reach the verification provider — try again in a moment.",
    };
  }

  if (outcome.status === "verified") {
    const { error: updateError } = await admin
      .from("profiles")
      .update({
        age_verified: true,
        age_verified_at: new Date().toISOString(),
        age_verification_status: "verified",
      })
      .eq("id", user.id);
    if (updateError) {
      logger.error("age_verification_verified_write_failed", {
        userId: user.id,
        updateError,
      });
      return { error: "Verification succeeded but couldn't be recorded — contact support." };
    }
    logger.info("age_verification_passed", { userId: user.id });
    return { configured: true, status: "verified", verified: true };
  }

  if (outcome.status === "failed" || outcome.status === "expired") {
    await admin
      .from("profiles")
      .update({ age_verification_status: outcome.status })
      .eq("id", user.id);
    logger.info("age_verification_not_passed", {
      userId: user.id,
      outcome: outcome.status,
    });
    return { configured: true, status: outcome.status, verified: false };
  }

  return { configured: true, status: "pending", verified: false };
}
