"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/actions/ai_wrapper";
import { redirect } from "next/navigation";

/**
 * Server action invoked by the login page after a Turnstile solve.
 * Verifies the captcha (when configured) and then performs the
 * Supabase OAuth sign-in for the requested provider.
 */
export async function signInWithProvider(
  provider: "google" | "discord",
  turnstileToken: string
): Promise<{ error?: string }> {
  if (!turnstileToken && process.env.TURNSTILE_SECRET_KEY) {
    return { error: "Please complete the captcha" };
  }

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