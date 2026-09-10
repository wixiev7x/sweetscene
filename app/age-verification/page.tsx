"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMyVerificationStatus,
  startAgeVerification,
  pollAgeVerificationOutcome,
} from "@/lib/actions/verification";
import { playSound } from "@/lib/utils/sound";

/* Age verification entry point. Three honest states up front:
 * not configured (nothing to do), in flow (start / check / pending),
 * and terminal (verified / failed with retry + support). */

type Status =
  | { kind: "loading" }
  | { kind: "not_configured" }
  | { kind: "unverified" }
  | { kind: "pending" }
  | { kind: "verified" }
  | { kind: "failed" }
  | { kind: "expired" }
  | { kind: "unavailable" };

export default function AgeVerificationPage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const load = useCallback(async () => {
    const result = await getMyVerificationStatus();
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError("");
    if (!result.configured) {
      setStatus({ kind: "not_configured" });
      return;
    }
    switch (result.status) {
      case "verified":
        setStatus({ kind: "verified" });
        break;
      case "pending":
        setStatus({ kind: "pending" });
        break;
      case "failed":
        setStatus({ kind: "failed" });
        break;
      case "expired":
        setStatus({ kind: "expired" });
        break;
      case "unavailable":
        setStatus({ kind: "unavailable" });
        break;
      default:
        setStatus({ kind: "unverified" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getMyVerificationStatus();
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (!result.configured) {
        setStatus({ kind: "not_configured" });
        return;
      }
      switch (result.status) {
        case "verified":
          setStatus({ kind: "verified" });
          break;
        case "pending":
          setStatus({ kind: "pending" });
          break;
        case "failed":
          setStatus({ kind: "failed" });
          break;
        case "expired":
          setStatus({ kind: "expired" });
          break;
        case "unavailable":
          setStatus({ kind: "unavailable" });
          break;
        default:
          setStatus({ kind: "unverified" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStart() {
    setStarting(true);
    setError("");
    try {
      const result = await startAgeVerification();
      if ("redirectUrl" in result) {
        playSound("click");
        window.location.assign(result.redirectUrl);
        return;
      }
      setError(result.error);
    } catch {
      setError("Something went wrong starting verification — try again.");
    } finally {
      setStarting(false);
    }
  }

  async function handleCheck() {
    setChecking(true);
    setError("");
    try {
      const result = await pollAgeVerificationOutcome();
      if ("error" in result && typeof result.error === "string") {
        setError(result.error);
        return;
      }
      await load();
    } catch {
      setError("Couldn't check your verification status — try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 py-10">
      <div className="max-w-lg mx-auto">
        <p className="type-eyebrow text-accent-candle mb-2">Age verification</p>
        <h1 className="type-display text-3xl mb-3">
          One check, <span className="gradient-text">kept minimal.</span>
        </h1>
        <p className="type-body text-muted mb-8 leading-relaxed">
          Verifying your age unlocks 18+ content. The check runs with an independent
          provider — <strong className="text-foreground">we only ever receive a
          pass/fail result</strong>. Your ID document and any biometric data stay
          with the provider and never touch SweetScene.
        </p>

        <div className="bg-surface border border-line rounded-[var(--radius-card)] p-6 sm:p-8">
          {status.kind === "loading" && (
            <div className="py-8 text-center">
              <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-line border-t-accent-candle" aria-hidden="true" />
              <p className="type-meta text-muted mt-3">Checking your status…</p>
            </div>
          )}

          {status.kind === "not_configured" && (
            <div className="py-4 text-center">
              <p className="type-body text-foreground mb-2">Nothing to verify yet.</p>
              <p className="type-meta text-muted">
                Age verification isn&rsquo;t active on this platform. 18+ features stay
                gated by your account&rsquo;s age confirmation.
              </p>
              <Link
                href="/profile"
                className="inline-flex mt-5 h-11 items-center rounded-full border border-line-strong px-6 text-sm font-medium text-foreground hover:border-accent-candle hover:text-accent-candle ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
              >
                Back to profile
              </Link>
            </div>
          )}

          {status.kind === "unverified" && (
            <div className="py-2">
              <p className="type-body text-foreground mb-2">You&rsquo;re not verified yet.</p>
              <p className="type-meta text-muted mb-6">
                The check takes a few minutes with a government ID or your
                provider&rsquo;s preferred method.
              </p>
              <button
                onClick={handleStart}
                disabled={starting}
                data-cursor="primary"
                aria-live="polite"
                className="w-full h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-accent-foreground text-base font-semibold ios-press shadow-lg shadow-brand/20 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none flex items-center justify-center gap-2"
              >
                {starting && (
                  <span className="w-4 h-4 rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground animate-spin" aria-hidden="true" />
                )}
                {starting ? "Opening verification…" : "Start age verification"}
              </button>
            </div>
          )}

          {status.kind === "pending" && (
            <div className="py-2">
              <p className="type-body text-foreground mb-2">Verification in progress.</p>
              <p className="type-meta text-muted mb-6">
                If you&rsquo;ve finished at the provider, check the result below. Still
                on their page? Come back when you&rsquo;re done.
              </p>
              <button
                onClick={handleCheck}
                disabled={checking}
                aria-live="polite"
                className="w-full h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-accent-foreground text-base font-semibold ios-press shadow-lg shadow-brand/20 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none flex items-center justify-center gap-2 mb-3"
              >
                {checking && (
                  <span className="w-4 h-4 rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground animate-spin" aria-hidden="true" />
                )}
                {checking ? "Checking…" : "Check the result"}
              </button>
              <button
                onClick={handleStart}
                disabled={starting}
                className="w-full type-body text-muted hover:text-foreground py-2 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none rounded"
              >
                Start over with a new attempt
              </button>
            </div>
          )}

          {status.kind === "verified" && (
            <div className="py-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-success/15 flex items-center justify-center text-success mb-3" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <p className="type-body text-foreground mb-2">You&rsquo;re verified.</p>
              <p className="type-meta text-muted mb-6">
                18+ features are unlocked on your account.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => {
                    playSound("click");
                    router.push("/profile");
                  }}
                  className="inline-flex h-11 items-center rounded-full bg-gradient-to-r from-brand to-brand-dark px-6 text-sm font-semibold text-accent-foreground ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
                >
                  Back to profile
                </button>
                <Link
                  href="/store"
                  className="inline-flex h-11 items-center rounded-full border border-line-strong px-6 text-sm font-medium text-foreground hover:border-accent-candle hover:text-accent-candle ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
                >
                  Browse the store
                </Link>
              </div>
            </div>
          )}

          {(status.kind === "failed" || status.kind === "expired") && (
            <div className="py-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-danger/15 flex items-center justify-center text-danger mb-3" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8v5M12 16.5h.01" />
                  <circle cx="12" cy="12" r="9.5" />
                </svg>
              </div>
              <p className="type-body text-foreground text-center mb-2">
                {status.kind === "failed"
                  ? "The check didn&rsquo;t pass."
                  : "This attempt expired."}
              </p>
              <p className="type-meta text-muted text-center mb-6">
                You can try again with a different document or method. If you believe
                this is an error, the{" "}
                <Link href="/safety" className="text-accent-candle hover:text-accent-candle-deep underline">safety page</Link>{" "}
                lists how to reach us.
              </p>
              <button
                onClick={handleStart}
                disabled={starting}
                data-cursor="primary"
                aria-live="polite"
                className="w-full h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-accent-foreground text-base font-semibold ios-press shadow-lg shadow-brand/20 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none flex items-center justify-center gap-2"
              >
                {starting && (
                  <span className="w-4 h-4 rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground animate-spin" aria-hidden="true" />
                )}
                {starting ? "Opening verification…" : "Try again"}
              </button>
            </div>
          )}

          {status.kind === "unavailable" && (
            <div className="py-2 text-center">
              <p className="type-body text-foreground mb-2">Verification isn&rsquo;t ready on this account yet.</p>
              <p className="type-meta text-muted mb-6">
                The verification system is still being set up. Nothing is blocked in
                the meantime — check back soon.
              </p>
              <Link
                href="/profile"
                className="inline-flex h-11 items-center rounded-full border border-line-strong px-6 text-sm font-medium text-foreground hover:border-accent-candle hover:text-accent-candle ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
              >
                Back to profile
              </Link>
            </div>
          )}

          {error && (
            <p className="type-body text-danger mt-4 text-center" role="alert">
              {error}
            </p>
          )}
        </div>

        <p className="type-meta text-muted-faint text-center mt-6 leading-relaxed">
          We store the provider&rsquo;s pass/fail result and a reference ID — nothing
          else. See the{" "}
          <Link href="/privacy" className="text-accent-candle/70 hover:text-accent-candle underline">Privacy Policy</Link>{" "}
          (§12) for exactly what happens to your documents.
        </p>
      </div>
    </div>
  );
}
