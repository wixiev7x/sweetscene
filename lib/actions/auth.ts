"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
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

/**
 * Email/password signup. Creates the user, auto-confirms the email via
 * the service-role admin client (so the user doesn't have to check
 * their inbox), then signs them in immediately.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  turnstileToken: string,
  username?: string
): Promise<{ error?: string }> {
  const headerList = await headers();
  const req = new Request("https://internal/auth-check", { headers: headerList });
  const { getClientIp } = await import("@/lib/utils/ratelimit");
  const ip = getClientIp(req);

  if (!(await rateLimitByIp(ip, 5, "5 m"))) {
    return { error: "Too many signup attempts. Please try again later." };
  }

  const captcha = await verifyTurnstile(turnstileToken);
  if ("error" in captcha) return { error: captcha.error };

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  if (!data.user) return { error: "Signup failed — no user returned." };

  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(data.user.id, {
      email_confirm: true,
    });

    if (username && username.trim().length >= 2) {
      await admin
        .from("profiles")
        .update({
          anonymous_username: username.trim(),
        })
        .eq("id", data.user.id);
    }
  } catch {
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    return {
      error:
        "Account created! Please check your email to confirm, then log in.",
    };
  }

  redirect("/lobby");
}

/**
 * Email/password login. Signs the user in and redirects to the lobby
 * (or the `next` search-param if one was provided).
 */
export async function signInWithEmail(
  email: string,
  password: string,
  turnstileToken: string
): Promise<{ error?: string }> {
  const headerList = await headers();
  const req = new Request("https://internal/auth-check", { headers: headerList });
  const { getClientIp } = await import("@/lib/utils/ratelimit");
  const ip = getClientIp(req);

  if (!(await rateLimitByIp(ip, 5, "5 m"))) {
    return { error: "Too many login attempts. Please try again later." };
  }

  const captcha = await verifyTurnstile(turnstileToken);
  if ("error" in captcha) return { error: captcha.error };

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  redirect("/lobby");
}

/**
 * Sign out the current user. Clears the session and redirects home.
 */
export async function signOut(): Promise<{ error?: string }> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Admin-only email/password login. Same mechanism as signInWithEmail,
 * but checks is_admin after sign-in. If the user is not an admin, the
 * session is immediately signed out and an error is returned. On
 * success, redirects to /admin.
 */
export async function signInAsAdmin(
  email: string,
  password: string,
  turnstileToken: string
): Promise<{ error?: string }> {
  const headerList = await headers();
  const req = new Request("https://internal/admin-auth-check", {
    headers: headerList,
  });
  const { getClientIp } = await import("@/lib/utils/ratelimit");
  const ip = getClientIp(req);

  if (!(await rateLimitByIp(ip, 5, "5 m"))) {
    return { error: "Too many login attempts. Please try again later." };
  }

  const captcha = await verifyTurnstile(turnstileToken);
  if ("error" in captcha) return { error: captcha.error };

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  const { data } = await supabase.rpc("assert_current_user_admin");
  const isAdmin = (data as unknown as boolean[] | null)?.[0];

  if (!isAdmin) {
    await supabase.auth.signOut();
    return { error: "Not authorized. This login is for administrators only." };
  }

  redirect("/admin");
}