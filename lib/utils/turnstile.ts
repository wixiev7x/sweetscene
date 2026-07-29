import "server-only";
import { getSetting, SETTING_KEYS } from "@/lib/config/settings";

/* ════════════════════════════════════════════════════════════════════
 * Cloudflare Turnstile verification (server-internal).
 *
 * Moved out of lib/actions/ai_wrapper.ts in Phase 12. That file carries
 * "use server", so this function was published as a client-callable
 * endpoint — handing anyone a free oracle that spends the platform's
 * Turnstile secret to test whether a captcha token is valid, at
 * whatever rate they like.
 *
 * It is called from signInWithProvider before a session exists, so it
 * cannot itself require authentication. That is exactly why it must not
 * be independently reachable: an unauthenticated endpoint with no rate
 * limit of its own.
 * ════════════════════════════════════════════════════════════════════ */

export type TurnstileResult = { success: true } | { error: string };

/**
 * Verifies a Cloudflare Turnstile token. Returns { success: true } only
 * when the token is valid. With no secret configured, verification is
 * skipped in development and fails closed in production (S6).
 */
export async function verifyTurnstile(
  token: string
): Promise<TurnstileResult> {
  const secret = await getSetting(
    SETTING_KEYS.turnstileSecretKey,
    process.env.TURNSTILE_SECRET_KEY
  );

  if (!secret) {
    /* S6: fail-closed in production, skip in development. */
    if (process.env.NODE_ENV === "production") {
      return { error: "Captcha not configured" };
    }
    return { success: true };
  }

  if (!token) return { error: "Captcha required" };

  try {
    const verifyUrl =
      process.env.TURNSTILE_VERIFY_URL ||
      "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    const res = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
      }),
    });

    const data = await res.json();
    if (data?.success === true) return { success: true };
    return { error: data?.["error-codes"]?.[0] ?? "Captcha failed" };
  } catch {
    return { error: "Captcha verification failed" };
  }
}
