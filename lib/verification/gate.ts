import "server-only";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { isVerificationConfigured } from "./config";

/* ════════════════════════════════════════════════════════════════════
 * Age/ID verification — server-side gate.
 *
 * Single source of truth for "is this user allowed past an age gate".
 * Reads the profiles row with the service-role client so the result is
 * correct regardless of column REVOKEs. Fails CLOSED for NSFW (unknown
 * or missing data = not allowed) and is inert for everything while no
 * provider is configured.
 * ════════════════════════════════════════════════════════════════════ */

export type VerificationState = {
  /** A provider is configured and the DB columns exist. */
  configured: boolean;
  verified: boolean;
  /** pending | verified | failed | expired | unverified | unavailable */
  status: string;
};

/**
 * Reads a user's verification state. Never throws — a database error
 * returns configured:false-equivalent "unavailable" state so callers
 * can decide fail-open (matchmaking pre-configuration) vs fail-closed
 * (NSFW) themselves.
 */
export async function getVerificationState(
  userId: string
): Promise<VerificationState> {
  const configured = isVerificationConfigured();
  if (!configured) {
    /* No provider keys → the whole system is inert by design. */
    return { configured: false, verified: true, status: "not_configured" };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("age_verified, age_verification_status")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      /* Column missing (migration not run) or row missing. */
      return { configured: true, verified: false, status: "unavailable" };
    }
    const row = data as { age_verified: boolean | null; age_verification_status: string | null };
    return {
      configured: true,
      verified: row.age_verified === true,
      status: row.age_verification_status ?? "unverified",
    };
  } catch {
    return { configured: true, verified: false, status: "unavailable" };
  }
}

/**
 * NSFW gate — fail closed. Requires age_cohort='adult' AND, when a
 * provider is configured, a passed ID verification. Unconfigured →
 * adult cohort alone still gates (matches the pre-verification
 * product rules, now actually enforced at the server).
 */
export async function isNsfwAccessAllowed(userId: string): Promise<{
  allowed: boolean;
  reason?: "minor" | "unverified" | "unavailable";
}> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("age_cohort, age_verified, age_verification_status")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return { allowed: false, reason: "unavailable" };
    }
    const row = data as {
      age_cohort: string | null;
      age_verified: boolean | null;
      age_verification_status: string | null;
    };

    if (row.age_cohort !== "adult") {
      return { allowed: false, reason: "minor" };
    }
    if (isVerificationConfigured() && row.age_verified !== true) {
      return { allowed: false, reason: "unverified" };
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "unavailable" };
  }
}
