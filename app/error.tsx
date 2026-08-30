"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SweetScene] Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-void-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md ios-card bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-neon-magenta/10 flex items-center justify-center">
          <span className="text-neon-magenta text-2xl">&#x2665;</span>
        </div>
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm text-muted mb-6">
          The scene hit an unexpected error. Your data is safe — try again or
          head back home.
        </p>
        {error.digest && (
          <p className="text-[10px] text-muted-faint mb-6">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="h-[52px] rounded-full text-white font-medium bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all ios-press"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="h-[52px] rounded-full flex items-center justify-center font-medium text-muted border border-white/10 hover:border-white/20 hover:text-foreground transition-all ios-press"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
