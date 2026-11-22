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
  return p && p.startsWith("/") && !p.startsWith("//") ? p : undefined;
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
  const [showEmail, setShowEmail] = useState(false);
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
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={isSignup ? "Create account" : "Sign in"}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div
        className="relative grid w-full max-w-[880px] overflow-hidden rounded-t-[2rem] bg-[#0b0b0d] ring-1 ring-white/10 sm:rounded-[2rem] md:grid-cols-[1fr_1.1fr]"
        style={{ animation: "iosSheetUp .3s var(--ios-ease) both" }}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        {/* Mood side */}
        <div className="relative hidden min-h-[560px] overflow-hidden md:block" style={{ background: "radial-gradient(120% 90% at 20% 100%, rgba(225,36,92,.55), rgba(60,8,24,.75) 45%, #050505 85%)" }}>
          <div className="absolute inset-0 bg-[radial-gradient(40%_30%_at_75%_25%,rgba(255,179,122,.18),transparent)]" />
          <div className="absolute inset-x-0 bottom-0 p-9">
            <p className="font-display text-[34px] leading-[1.1] text-white">
              {isSignup ? <>Someone is<br />waiting for you.</> : <>Welcome back.<br />They missed you.</>}
            </p>
            <p className="mt-3 text-sm text-white/70">Anonymous. Free to start. Yours to reveal.</p>
          </div>
        </div>

        {/* Form side */}
        <div className="max-h-[92dvh] overflow-y-auto px-6 pb-7 pt-10 sm:px-9">
          <h2 className="font-display text-[28px] text-foreground">{isSignup ? "Create your account" : "Sign in"}</h2>
          <p className="mt-1 text-sm text-muted">
            {isSignup ? "Already have one? " : "New here? "}
            <button type="button" onClick={() => setMode(isSignup ? "login" : "signup")} className="text-brand-light hover:underline">
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>

          <div className="mt-6">
            <OAuthButtons onSignIn={oauth} />
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {!showEmail ? (
            <button type="button" onClick={() => setShowEmail(true)} className="h-12 w-full rounded-full bg-white/[.06] text-[15px] text-foreground hover:bg-white/10">
              Continue with email
            </button>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              {isSignup && (
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Anonymous name" autoComplete="nickname" className="h-12 w-full rounded-full bg-white/[.06] px-5 text-[15px] text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand/60" />
              )}
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email" autoComplete="email" className="h-12 w-full rounded-full bg-white/[.06] px-5 text-[15px] text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand/60" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} placeholder="Password" autoComplete={isSignup ? "new-password" : "current-password"} className="h-12 w-full rounded-full bg-white/[.06] px-5 text-[15px] text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand/60" />
              <button type="submit" disabled={pending} className="h-13 min-h-[52px] w-full rounded-full bg-brand text-base text-white transition-transform active:scale-[0.98] disabled:opacity-60">
                {pending ? "One moment…" : isSignup ? "Create account" : "Sign in"}
              </button>
            </form>
          )}

          <label className="mt-5 flex cursor-pointer items-start gap-3 text-[13px] leading-snug text-muted-strong">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
            <span>
              I&rsquo;m 16 or older and accept the{" "}
              <a href="/terms" target="_blank" className="text-foreground-dim underline">Terms</a> and{" "}
              <a href="/privacy" target="_blank" className="text-foreground-dim underline">Privacy Policy</a>.
            </span>
          </label>

          {SITE_KEY && (
            <div className="mt-4">
              <TurnstileWidget siteKey={SITE_KEY} onVerify={setToken} />
            </div>
          )}
          {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}
