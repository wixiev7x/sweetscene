"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signInWithProvider, signInWithEmail } from "@/lib/actions/auth";
import TurnstileWidget from "@/components/TurnstileWidget";
import OAuthButtons from "@/components/auth/OAuthButtons";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function LoginPage() {
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [tosAccepted, setTosAccepted] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);

  function applyRemember() {
    if (rememberMe) {
      document.cookie = "sweetscene-remember=1; path=/; max-age=2592000; samesite=lax";
    } else {
      document.cookie = "sweetscene-remember=; path=/; max-age=0; samesite=lax";
    }
  }

  async function handleSignIn(provider: "google" | "discord") {
    if (!tosAccepted) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }
    if (SITE_KEY && !turnstileToken) {
      setError("Please complete the captcha.");
      return;
    }
    setError("");
    applyRemember();
    const result = await signInWithProvider(provider, turnstileToken ?? "");
    if (result?.error) setError(result.error);
  }

  function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!tosAccepted) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }
    if (SITE_KEY && !turnstileToken) {
      setError("Please complete the captcha.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError("");
    applyRemember();
    startTransition(async () => {
      const result = await signInWithEmail(email, password, turnstileToken);
      if (result?.error) setError(result.error);
    });
  }

  const inputClass =
    "w-full rounded-[var(--radius-control)] bg-surface-sunken border border-line px-4 py-3 text-sm text-foreground placeholder:text-muted-faint focus:outline-none focus:ring-2 focus:ring-line-focus focus:border-accent-candle/40 transition-colors";

  return (
    <main className="min-h-screen bg-background text-foreground flex">
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand-art.png" alt="SweetScene brand art" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-10">
          <p className="font-retro text-sm text-accent-candle tracking-widest mb-3">SWEETSCENE</p>
          <h2 className="font-retro text-4xl leading-tight text-foreground mb-3">
            Your scene is <span className="gradient-text">waiting.</span>
          </h2>
          <p className="text-sm text-muted max-w-sm mb-4">
            Anonymous AI matchmaking. Reveal only when both sides agree.
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-faint">
            16+ platform to join
          </p>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center p-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,190,120,0.07), transparent)" }}
        />
        <div className="relative w-full max-w-sm">
          <div className="bg-surface border border-line rounded-[var(--radius-card)] p-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent-candle mb-2">
              Welcome back
            </p>
            <h1 className="font-retro text-3xl text-foreground mb-6">Enter the scene.</h1>

            <OAuthButtons onSignIn={handleSignIn} />

            <button
              type="button"
              onClick={() => setShowEmailForm((v) => !v)}
              className="mt-4 w-full text-center text-sm text-muted hover:text-accent-candle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus rounded-lg py-1"
            >
              {showEmailForm ? "Use Google or Discord instead" : "Use email instead"}
            </button>

            {showEmailForm && (
              <form onSubmit={handleEmailSignIn} className="mt-4 animate-slide-up">
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-line" />
                  <span className="text-xs text-muted-faint">or</span>
                  <div className="flex-1 h-px bg-line" />
                </div>
                <div className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className={inputClass}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={pending}
                  className="mt-4 w-full h-[52px] rounded-full bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-light text-accent-foreground font-semibold active:scale-95 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                >
                  {pending ? "Signing in…" : "Sign In"}
                </button>
                <Link
                  href="/forgot-password"
                  className="mt-3 block text-center text-xs text-muted hover:text-accent-candle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus rounded"
                >
                  Forgot password?
                </Link>
              </form>
            )}

            <div className="mt-6 space-y-3">
              <label className="flex items-start gap-3 text-xs text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  className="mt-0.5 accent-accent-candle"
                />
                <span>
                  I agree to the{" "}
                  <Link href="/legal/terms" className="text-accent-candle hover:text-accent-candle-deep underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/legal/privacy" className="text-accent-candle hover:text-accent-candle-deep underline">
                    Privacy Policy
                  </Link>
                  . I confirm I am 16 or older.
                </span>
              </label>
              <label className="flex items-center gap-3 text-xs text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="accent-accent-candle"
                />
                <span>Remember me for 30 days</span>
              </label>
            </div>

            {SITE_KEY && (
              <div className="mt-4 flex justify-center">
                <TurnstileWidget siteKey={SITE_KEY} onVerify={setTurnstileToken} />
              </div>
            )}

            {error && <p className="mt-4 text-xs text-danger">{error}</p>}
          </div>

          <p className="mt-6 text-center text-sm text-muted">
            New here?{" "}
            <Link href="/signup" className="text-accent-candle hover:text-accent-candle-deep font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus rounded">
              Create one.
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
