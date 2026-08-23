"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signInAsAdmin } from "@/lib/actions/auth";
import TurnstileWidget from "@/components/TurnstileWidget";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function AdminLoginPage() {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (SITE_KEY && !turnstileToken) {
      setError("Please complete the captcha first.");
      return;
    }
    startTransition(async () => {
      const result = await signInAsAdmin(
        email,
        password,
        turnstileToken ?? ""
      );
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-8 flex flex-col items-center text-center">
        <h1 className="text-xl font-bold mb-1">Admin Login</h1>
        <p className="text-sm text-muted mb-6">
          Restricted access. Administrators only.
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-surface-sunken border border-line text-sm text-foreground placeholder-muted-faint focus:outline-none focus:border-line-focus transition-colors"
            autoComplete="email"
            disabled={pending}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-surface-sunken border border-line text-sm text-foreground placeholder-muted-faint focus:outline-none focus:border-line-focus transition-colors"
            autoComplete="current-password"
            disabled={pending}
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full px-5 py-3 rounded-lg font-medium text-white bg-brand hover:bg-brand-light active:scale-95 transform transition-all disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {SITE_KEY && (
          <div className="mt-6 w-full flex justify-center">
            <TurnstileWidget siteKey={SITE_KEY} onVerify={setTurnstileToken} />
          </div>
        )}

        {error && <p className="text-xs text-danger mt-4">{error}</p>}

        <p className="text-xs text-muted mt-6">
          Not an admin?{" "}
          <Link
            href="/login"
            className="text-brand-light hover:text-brand-lighter underline"
          >
            Regular login
          </Link>
        </p>
      </div>
    </div>
  );
}
