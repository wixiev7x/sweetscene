"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/utils/turnstile";
import { rateLimitByIp } from "@/lib/utils/ratelimit";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

/**
 * Server action invoked by the login page after a Turnstile solve.
 * Verifies the captcha (when configured) and then performs the
 * Supabase OAuth sign-in for the requested provider.
 *
 * Phase 5b:
 *   - S4: IP-based brute-force throttle (5 attempts per 5 minutes per IP)
 *     using the rateLimitByIp helper that reads CF-Connecting-IP /
 *     X-Forwarded-For.
 */
export async function signInWithProvider(
  provider: "google" | "discord",
  turnstileToken: string
): Promise<{ error?: string }> {
  /* S4: IP-based brute-force throttle. 5 OAuth attempts per 5 minutes
     per IP — prevents credential stuffing via the OAuth endpoints. */
  const headerList = await headers();
  const req = new Request("https://internal/auth-check", { headers: headerList });
  const { getClientIp } = await import("@/lib/utils/ratelimit");
  const ip = getClientIp(req);

  if (!(await rateLimitByIp(ip, 5, "5 m"))) {
    return { error: "Too many login attempts. Please try again later." };
  }

  /* verifyTurnstile resolves the secret itself (dashboard, then env)
     and fails closed in production, so an empty token just falls
     through to it rather than being pre-checked against env here. */
  const captcha = await verifyTurnstile(turnstileToken);
  if ("error" in captcha) return { error: captcha.error };

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`,
    },
  });

  if (error || !data?.url) {
    return { error: error?.message ?? "OAuth failed" };
  }

  /* signInWithOAuth returns a URL we must send the browser to. */
  redirect(data.url);
}