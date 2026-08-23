"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signInWithProvider, signUpWithEmail } from "@/lib/actions/auth";
import TurnstileWidget from "@/components/TurnstileWidget";
import { playSound } from "@/lib/utils/sound";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function SignupPage() {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [tosAccepted, setTosAccepted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSignIn(provider: "google" | "discord") {
    setError("");
    if (!tosAccepted) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }
    if (SITE_KEY && !turnstileToken) {
      setError("Please complete the captcha first.");
      return;
    }
    playSound("matchFound");
    startTransition(async () => {
      const result = await signInWithProvider(provider, turnstileToken ?? "");
      if (result?.error) setError(result.error);
    });
  }

  function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!tosAccepted) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }
    if (SITE_KEY && !turnstileToken) {
      setError("Please complete the captcha first.");
      return;
    }
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    playSound("matchFound");
    startTransition(async () => {
      const result = await signUpWithEmail(email, password, turnstileToken ?? "");
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen bg-void-950 text-white flex items-center justify-center px-6">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,45,149,0.12)_0%,transparent_60%)]" />
      <div className="relative z-10 w-full max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center">
        <span className="text-xs tracking-[0.4em] text-brand/60 uppercase font-retro">SweetScene</span>
        <h1 className="text-2xl font-light text-foreground mt-4">Create your anonymous identity.</h1>
        <p className="text-sm text-muted mt-2">No faces. No names. Just vibes.</p>

        <form onSubmit={handleEmailSignUp} className="w-full mt-6 flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:border-neon-magenta/30 transition-colors"
            autoComplete="email"
            disabled={pending}
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:border-neon-magenta/30 transition-colors"
            autoComplete="new-password"
            disabled={pending}
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full px-5 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 active:scale-95 transform transition-all disabled:opacity-50"
          >
            {pending ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div className="w-full flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-muted-faint">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <label className="flex items-start gap-2 w-full text-left cursor-pointer">
          <input type="checkbox" checked={tosAccepted} onChange={(e) => setTosAccepted(e.target.checked)} className="mt-0.5 accent-brand" />
          <span className="text-xs text-muted leading-relaxed">
            I agree to the <a href="/legal/terms" className="text-brand-light hover:text-brand-lighter underline">Terms of Service</a> and{" "}
            <a href="/legal/privacy" className="text-brand-light hover:text-brand-lighter underline">Privacy Policy</a>. I confirm I am 16 or older.
          </span>
        </label>

        <div className="flex flex-col gap-3 w-full mt-4">
          <button type="button" disabled={pending} onClick={() => handleSignIn("google")}
            className="w-full px-5 py-3 rounded-xl font-medium text-white bg-white/10 border border-white/10 hover:bg-white/15 active:scale-95 transform transition-all disabled:opacity-50">
            Continue with Google
          </button>
          <button type="button" disabled={pending} onClick={() => handleSignIn("discord")}
            className="w-full px-5 py-3 rounded-xl font-medium text-white bg-[#5865F2]/20 border border-[#5865F2]/40 hover:bg-[#5865F2]/30 active:scale-95 transform transition-all disabled:opacity-50">
            Continue with Discord
          </button>
        </div>

        {SITE_KEY && <div className="mt-6 w-full flex justify-center"><TurnstileWidget siteKey={SITE_KEY} onVerify={setTurnstileToken} /></div>}
        {error && <p className="text-xs text-danger mt-4">{error}</p>}
        {pending && <p className="text-xs text-muted mt-4">Creating your account…</p>}

        <p className="text-xs text-muted mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-light hover:text-brand-lighter underline">Welcome back. Enter the scene.</Link>
        </p>
      </div>
    </div>
  );
}
