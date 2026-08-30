"use client";

import { useState } from "react";
import { toast } from "sonner";

type Provider = "google" | "discord";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.27 18.27 0 0 0-5.49 0 12.6 12.6 0 0 0-.61-1.25.08.08 0 0 0-.08-.04 19.74 19.74 0 0 0-4.88 1.52.07.07 0 0 0-.04.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.22-2a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 .01-.13c.13-.09.25-.19.37-.29a.07.07 0 0 1 .08-.01c3.93 1.8 8.18 1.8 12.06 0a.07.07 0 0 1 .08.01c.12.1.24.2.37.3a.08.08 0 0 1-.01.12 12.3 12.3 0 0 1-1.87.9.08.08 0 0 0-.04.11c.36.7.77 1.37 1.22 2a.08.08 0 0 0 .08.03 19.84 19.84 0 0 0 6.01-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function OAuthButtons({
  onSignIn,
}: {
  onSignIn: (provider: Provider) => Promise<{ error?: string } | void>;
}) {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  async function handle(provider: Provider) {
    if (loadingProvider) return;
    setLoadingProvider(provider);
    try {
      const result = await onSignIn(provider);
      if (result && result.error) toast.error(result.error);
    } catch {
      toast.error("Could not start sign-in. Please try again.");
    } finally {
      setLoadingProvider(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={loadingProvider !== null}
        onClick={() => handle("google")}
        className="h-[52px] w-full rounded-full flex items-center justify-center gap-3 bg-white text-black font-medium ios-press transition-all disabled:opacity-60"
      >
        {loadingProvider === "google" ? (
          <>
            <Spinner />
            <span>Connecting…</span>
          </>
        ) : (
          <>
            <GoogleIcon />
            <span>Continue with Google</span>
          </>
        )}
      </button>
      <button
        type="button"
        disabled={loadingProvider !== null}
        onClick={() => handle("discord")}
        className="h-[52px] w-full rounded-full flex items-center justify-center gap-3 bg-[#5865F2] text-white font-medium ios-press transition-all disabled:opacity-60"
      >
        {loadingProvider === "discord" ? (
          <>
            <Spinner />
            <span>Connecting…</span>
          </>
        ) : (
          <>
            <DiscordIcon />
            <span>Continue with Discord</span>
          </>
        )}
      </button>
    </div>
  );
}

export default OAuthButtons;
