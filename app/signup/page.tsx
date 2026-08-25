"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signInWithProvider, signUpWithEmail } from "@/lib/actions/auth";
import TurnstileWidget from "@/components/TurnstileWidget";
import { playSound } from "@/lib/utils/sound";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const AVATAR_GRADIENTS = [
  "from-brand to-brand-dark",
  "from-crimson-600 to-crimson-500",
  "from-blue-500 to-purple-600",
  "from-green-500 to-teal-600",
  "from-orange-500 to-red-600",
  "from-pink-500 to-rose-600",
];

export default function SignupPage() {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [tosAccepted, setTosAccepted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarIdx, setAvatarIdx] = useState(0);

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
    if (!username || username.trim().length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }
    playSound("matchFound");
    startTransition(async () => {
      const result = await signUpWithEmail(email, password, turnstileToken ?? "", username);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen bg-void-950 text-white flex items-center justify-center px-6 py-12">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,45,149,0.12)_0%,transparent_60%)]" />
      <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center">
        <span className="text-xs tracking-[0.4em] text-brand/60 uppercase font-retro">SweetScene</span>
        <h1 className="text-2xl font-light text-foreground mt-4">Create your anonymous identity.</h1>
        <p className="text-sm text-muted mt-2">No faces. No names. Just vibes.</p>

        <div className="flex flex-col items-center gap-3 mt-6">
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[avatarIdx]} flex items-center justify-center text-3xl font-bold text-white shadow-lg`}>
            {username ? username.charAt(0).toUpperCase() : "?"}
          </div>
          <div className="flex gap-1.5">
            {AVATAR_GRADIENTS.map((g, i) => (
              <button
                key={i}
                onClick={() => setAvatarIdx(i)}
                className={`w-6 h-6 rounded-full bg-gradient-to-br ${g} transition-all ${
                  avatarIdx === i ? "ring-2 ring-white scale-110" : "opacity-50 hover:opacity-80"
                }`}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleEmailSignUp} className="w-full mt-6 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Username (2+ characters)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:border-neon-magenta/30 transition-colors"
            autoComplete="username"
            disabled={pending}
            maxLength={20}
          />
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
          <textarea
            placeholder="Bio (optional — tell people what you're into)"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:border-neon-magenta/30 transition-colors resize-none"
            rows={2}
            disabled={pending}
            maxLength={150}
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
