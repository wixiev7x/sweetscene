"use client";

import { createContext, useCallback, useContext, useEffect, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { signInWithProvider, signInWithEmail, signUpWithEmail } from "@/lib/actions/auth";
import TurnstileWidget from "@/components/TurnstileWidget";
import OAuthButtons from "@/components/auth/OAuthButtons";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type Mode = "signup" | "login";
type Ctx = { openAuth: (mode?: Mode, next?: string) => void };
const AuthCtx = createContext<Ctx>({ openAuth: () => {} });

/** Open the sign-in / create-account popup from anywhere. */
export function useAuthModal() {
  return useContext(AuthCtx);
}

function safePath(p: string | null | undefined) {
  return p && p.startsWith("/") && !p.startsWith("//") && !p.includes("\\") ? p : undefined;
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signup");
  const [next, setNext] = useState<string | undefined>();

  const openAuth = useCallback(
    (m: Mode = "signup", n?: string) => {
      setMode(m);
      setNext(safePath(n) ?? pathname ?? "/");
      setOpen(true);
    },
    [pathname],
  );

  /* ?auth=signup|login (from server fallbacks) opens the popup on load. */
  useEffect(() => {
    const a = search?.get("auth");
    if (a === "signup" || a === "login" || a === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openAuth(a === "login" ? "login" : "signup", safePath(search?.get("next")));
    }
  }, [search, openAuth]);

  return (
    <AuthCtx.Provider value={{ openAuth }}>
      {children}
      {open && <AuthDialog mode={mode} setMode={setMode} next={next} onClose={() => setOpen(false)} />}
    </AuthCtx.Provider>
  );
}

function AuthDialog({
  mode,
  setMode,
  next,
  onClose,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  next?: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [agree, setAgree] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function gate(): string | null {
    if (!agree) return "Please confirm you're 16+ and accept the Terms.";
    if (SITE_KEY && !token) return "Please complete the check.";
    return null;
  }

  async function oauth(provider: "google" | "discord") {
    const g = gate();
    if (g) return { error: g };
    return signInWithProvider(provider, token, next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const g = gate();
    if (g) return setError(g);
    setError("");
    start(async () => {
      const r =
        mode === "signup"
          ? await signUpWithEmail(email.trim(), password, token, username.trim() || undefined, next)
          : await signInWithEmail(email.trim(), password, token, next);
      if (r?.error) setError(r.error);
    });
  }

  const isSignup = mode === "signup";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={isSignup ? "Create account" : "Sign in"}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-xl" />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/25 blur-[120px]" />
      <div
        className="relative w-full max-w-[480px] rounded-[2rem] bg-[#121214]/95 ring-1 ring-white/10 shadow-2xl"
        style={{ animation: "iosSheetUp .3s var(--ios-ease) both" }}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        <div className="max-h-[90dvh] overflow-y-auto px-7 pb-8 pt-12 sm:px-10">
          <h2 className="text-center font-display text-[32px] leading-tight text-white">
            {isSignup ? <>Welcome to sweet<span className="text-brand">scene</span></> : "Welcome back"}
          </h2>
          <p className="mt-3 text-center text-[16px] text-muted-strong">
            {isSignup ? "Create an account to keep going" : "Sign in to pick up where you left off"}
          </p>

          <div className="mt-8">
            <OAuthButtons onSignIn={oauth} variant="white" />
          </div>

          <div className="my-6 flex items-center gap-4 text-sm text-muted">
            <span className="h-px flex-1 bg-white/10" />
            OR
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {isSignup && (
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Anonymous name" autoComplete="nickname" className="h-14 w-full rounded-full bg-white/[.06] px-6 text-[16px] text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/60" />
            )}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email" autoComplete="email" className="h-14 w-full rounded-full bg-white/[.06] px-6 text-[16px] text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/60" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} placeholder="Password" autoComplete={isSignup ? "new-password" : "current-password"} className="h-14 w-full rounded-full bg-white/[.06] px-6 text-[16px] text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/60" />
            <button type="submit" disabled={pending} className="h-14 w-full rounded-full bg-brand text-[17px] text-white shadow-[0_14px_40px_-14px_var(--brand)] transition-transform active:scale-[0.98] disabled:opacity-60">
              {pending ? "One moment…" : isSignup ? "Create account" : "Sign in"}
            </button>
          </form>

          <label className="mt-5 flex cursor-pointer items-start gap-3 text-[13px] leading-snug text-muted-strong">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
            <span>
              I&rsquo;m 16 or older and accept the{" "}
              <a href="/terms" target="_blank" className="text-foreground-dim underline">Terms</a> and{" "}
              <a href="/privacy" target="_blank" className="text-foreground-dim underline">Privacy Policy</a>.
            </span>
          </label>

          {SITE_KEY && (
            <div className="mt-4 flex justify-center">
              <TurnstileWidget siteKey={SITE_KEY} onVerify={setToken} />
            </div>
          )}
          {error && <p className="mt-3 text-center text-sm text-danger" role="alert">{error}</p>}

          <p className="mt-6 text-center text-[15px] text-muted">
            {isSignup ? "Already have an account? " : "New here? "}
            <button type="button" onClick={() => setMode(isSignup ? "login" : "signup")} className="text-brand-light hover:underline">
              {isSignup ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
