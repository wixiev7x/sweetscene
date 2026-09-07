"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signInWithProvider, signUpWithEmail } from "@/lib/actions/auth";
import TurnstileWidget from "@/components/TurnstileWidget";
import OAuthButtons from "@/components/auth/OAuthButtons";
import { playSound } from "@/lib/utils/sound";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const AVATAR_GRADIENTS = [
  "from-accent-candle to-accent-candle-deep",
  "from-accent-rose to-crimson-500",
  "from-brand to-brand-dark",
  "from-info to-ios-indigo",
  "from-success to-ios-teal",
  "from-warning to-accent-candle-deep",
];

const inputClass =
  "w-full px-4 py-3 rounded-[var(--radius-control)] bg-surface-sunken border border-line text-sm text-foreground placeholder-muted-faint focus:outline-none focus:ring-2 focus:ring-line-focus focus:border-accent-candle/40 transition-colors";

export default function SignupPage() {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [tosAccepted, setTosAccepted] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarIdx, setAvatarIdx] = useState(0);
  const [showEmailForm, setShowEmailForm] = useState(false);

  function applyRemember() {
    if (rememberMe) {
      document.cookie = "sweetscene-remember=1; path=/; max-age=2592000; samesite=lax";
    } else {
      document.cookie = "sweetscene-remember=; path=/; max-age=0; samesite=lax";
    }
  }

  async function handleSignIn(provider: "google" | "discord") {
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
    applyRemember();
    await signInWithProvider(provider, turnstileToken ?? "");
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
    if (!username || username.trim().length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }
    playSound("matchFound");
    applyRemember();
    startTransition(async () => {
      const result = await signUpWithEmail(email, password, turnstileToken ?? "", username);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand-art.png" alt="SweetScene brand art" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="relative z-10 mt-auto p-10">
          <span className="font-retro text-sm text-accent-candle tracking-[0.4em] uppercase">SWEETSCENE</span>
          <h2 className="font-retro text-4xl mt-4 text-foreground">
            Step into the <span className="gradient-text">scene.</span>
          </h2>
          <p className="text-sm text-muted mt-3 max-w-sm">
            No faces. No names. Just vibes — match first, reveal only when both sides agree.
          </p>
          <p className="text-xs font-mono text-muted-faint mt-6 uppercase tracking-wider">
            16+ platform to join
          </p>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center p-6">
        <div className="fixed inset-0 pointer-events-none lg:hidden bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,190,120,0.07)_0%,transparent_60%)]" />

        <div className="relative z-10 w-full max-w-sm bg-surface border border-line rounded-[var(--radius-card)] p-8 flex flex-col items-center text-center">
          <span className="text-xs font-mono tracking-[0.35em] text-accent-candle uppercase">Create your identity</span>
          <h1 className="font-retro text-2xl mt-4">Join the scene.</h1>
          <p className="text-sm text-muted mt-2">Your anonymous identity starts here.</p>

          <div className="flex flex-col gap-3 w-full mt-6">
            <OAuthButtons onSignIn={handleSignIn} />
          </div>

          {!showEmailForm ? (
            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              className="text-xs text-muted mt-4 hover:text-accent-candle underline transition-colors focus-visible:ring-2 ring-line-focus rounded px-1 py-0.5 outline-none"
            >
              Use email instead
            </button>
          ) : (
            <>
              <div className="w-full flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-line" />
                <span className="text-xs text-muted-faint">or</span>
                <div className="flex-1 h-px bg-line" />
              </div>

              <div className="flex flex-col items-center gap-3 animate-slide-up">
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[avatarIdx]} flex items-center justify-center text-3xl font-retro text-accent-foreground shadow-lg`}>
                  {username ? username.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="flex gap-1.5">
                  {AVATAR_GRADIENTS.map((g, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAvatarIdx(i)}
                      aria-label={`Pick avatar style ${i + 1}`}
                      className={`w-6 h-6 rounded-full bg-gradient-to-br ${g} transition-all focus-visible:ring-2 ring-line-focus outline-none ${
                        avatarIdx === i ? "ring-2 ring-accent-candle scale-110" : "opacity-50 hover:opacity-80"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <form onSubmit={handleEmailSignUp} className="w-full mt-6 flex flex-col gap-3 animate-slide-up">
                <input
                  type="text"
                  placeholder="Username (2+ characters)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputClass}
                  autoComplete="username"
                  disabled={pending}
                  maxLength={20}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  autoComplete="email"
                  disabled={pending}
                />
                <input
                  type="password"
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                  disabled={pending}
                />
                <textarea
                  placeholder="Bio (optional — tell people what you're into)"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className={`${inputClass} resize-none`}
                  rows={2}
                  disabled={pending}
                  maxLength={150}
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full h-[52px] rounded-full font-medium text-accent-foreground bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-light active:scale-95 transform transition-all disabled:opacity-50 focus-visible:ring-2 ring-line-focus outline-none"
                >
                  {pending ? "Creating account…" : "Create Account"}
                </button>
              </form>
            </>
          )}

          <label className="flex items-start gap-2 w-full text-left cursor-pointer mt-4">
            <input
              type="checkbox"
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              className="mt-0.5 accent-accent-candle"
            />
            <span className="text-xs text-muted leading-relaxed">
              I agree to the{" "}
              <a href="/legal/terms" className="text-accent-candle hover:text-accent-candle-deep underline">Terms of Service</a>{" "}
              and{" "}
              <a href="/legal/privacy" className="text-accent-candle hover:text-accent-candle-deep underline">Privacy Policy</a>
              . I confirm I am 16 or older.
            </span>
          </label>

          <label className="flex items-center gap-2 w-full text-left cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="accent-accent-candle"
            />
            <span className="text-xs text-muted">Remember me for 30 days</span>
          </label>

          {SITE_KEY && (
            <div className="mt-6 w-full flex justify-center">
              <TurnstileWidget siteKey={SITE_KEY} onVerify={setTurnstileToken} />
            </div>
          )}

          {error && <p className="text-xs text-danger mt-4">{error}</p>}

          <p className="text-xs text-muted mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-accent-candle hover:text-accent-candle-deep underline">Welcome back.</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
