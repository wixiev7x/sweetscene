"use client";

import { useState, useTransition } from "react";
import { signInWithProvider } from "@/lib/actions/auth";
import TurnstileWidget from "@/components/TurnstileWidget";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Login page. Offers Google and Discord OAuth via Supabase. Cloudflare
 * Turnstile is shown when a site key is configured.
 */
export default function LoginPage() {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSignIn(provider: "google" | "discord") {
    setError("");
    if (SITE_KEY && !turnstileToken) {
      setError("Please complete the captcha first.");
      return;
    }
    startTransition(async () => {
      const result = await signInWithProvider(
        provider,
        turnstileToken ?? ""
      );
      /* redirect() throws on success; reaching here means an error. */
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_30%,rgba(88,28,135,0.15)_0%,transparent_60%)]" />

      <div className="relative z-10 w-full max-w-sm bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center">
        <span className="text-xs tracking-[0.4em] text-purple-500/60 uppercase">
          chatty
        </span>
        <h1 className="text-2xl font-light text-gray-200 mt-4">
          Enter the fog
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          Sign in anonymously to match, roleplay, and reveal.
        </p>

        <div className="flex flex-col gap-3 w-full mt-8">
          <button
            type="button"
            disabled={pending}
            onClick={() => handleSignIn("google")}
            className="w-full px-5 py-3 rounded-xl font-medium text-white bg-white/10 border border-white/10 hover:bg-white/15 active:scale-95 transform transition-all disabled:opacity-50"
          >
            Continue with Google
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => handleSignIn("discord")}
            className="w-full px-5 py-3 rounded-xl font-medium text-white bg-[#5865F2]/20 border border-[#5865F2]/40 hover:bg-[#5865F2]/30 active:scale-95 transform transition-all disabled:opacity-50"
          >
            Continue with Discord
          </button>
        </div>

        {SITE_KEY && (
          <div className="mt-6 w-full flex justify-center">
            <TurnstileWidget
              siteKey={SITE_KEY}
              onVerify={setTurnstileToken}
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 mt-4">{error}</p>
        )}

        {pending && (
          <p className="text-xs text-gray-500 mt-4">Redirecting…</p>
        )}
      </div>
    </div>
  );
}