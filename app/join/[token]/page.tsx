"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { playSound } from "@/lib/utils/sound";

type LinkState =
  | { phase: "checking" }
  | { phase: "invalid" }
  | { phase: "expired" }
  | { phase: "revoked" }
  | { phase: "ready"; creator: string | null; botName: string | null; expiresAt: string | null }
  | { phase: "own_link" }
  | { phase: "joining" }
  | { phase: "error"; message: string };

export default function JoinInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;
  const [state, setState] = useState<LinkState>({ phase: "checking" });
  const joinedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invite?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.state === "valid") {
          setState({
            phase: "ready",
            creator: data.creator,
            botName: data.bot_name,
            expiresAt: data.expires_at,
          });
        } else if (data.state === "expired") {
          setState({ phase: "expired" });
        } else if (data.state === "revoked") {
          setState({ phase: "revoked" });
        } else {
          setState({ phase: "invalid" });
        }
      } catch {
        if (!cancelled) setState({ phase: "error", message: "Couldn't check this invite — try again." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const enterRoom = async () => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    setState((s) => (s.phase === "ready" ? { phase: "joining" } : s));
    playSound("matchSearch");
    try {
      const res = await fetch("/api/invite/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.status === 401) {
        router.push(`/signup?next=/join/${token}`);
        return;
      }
      const data = await res.json();
      if (data.state === "matched" && data.matchId) {
        playSound("matchFound");
        router.push(`/chat/${data.matchId}`);
        return;
      }
      if (data.state === "own_link") {
        setState({ phase: "own_link" });
        return;
      }
      if (data.state === "expired") {
        setState({ phase: "expired" });
        return;
      }
      if (data.state === "revoked") {
        setState({ phase: "revoked" });
        return;
      }
      setState({ phase: "error", message: data.error || "Couldn't enter the room — try again." });
    } catch {
      setState({ phase: "error", message: "Couldn't enter the room — try again." });
    } finally {
      joinedRef.current = false;
    }
  };

  const expiresLabel = (iso: string | null) => {
    if (!iso) return "This link never expires";
    const d = new Date(iso);
    return `Active until ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 py-12 flex items-center justify-center">
      <div className="w-full max-w-md">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-candle mb-2 text-center">
          Private invitation
        </p>
        <h1 className="font-display text-3xl md:text-4xl mb-6 text-center">
          A room <span className="gradient-text">awaits.</span>
        </h1>

        <div className="bg-surface border border-line rounded-[var(--radius-card)] p-6 sm:p-8 flex flex-col items-center text-center">
          {state.phase === "checking" && (
            <>
              <div className="w-6 h-6 rounded-full border-2 border-line border-t-accent-candle animate-spin mb-4" aria-label="Checking invite" />
              <p className="text-sm text-muted">Checking this invitation…</p>
            </>
          )}

          {state.phase === "ready" && (
            <>
              <p className="text-sm text-muted mb-1">
                {state.creator ? (
                  <>
                    <span className="text-foreground font-medium">{state.creator}</span> invited you to a private scene.
                  </>
                ) : (
                  "Someone invited you to a private scene."
                )}
              </p>
              {state.botName && (
                <p className="text-xs text-muted mb-4">
                  Character: <span className="text-accent-candle font-medium">{state.botName}</span>
                </p>
              )}
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-faint mb-6">
                {expiresLabel(state.expiresAt)}
              </p>
              <button
                onClick={enterRoom}
                className="w-full max-w-xs h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-accent-foreground text-base font-semibold ios-press shadow-lg shadow-brand/20 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
              >
                Enter the Room
              </button>
              <Link
                href="/matchmake"
                className="text-sm text-muted hover:text-foreground mt-4 ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none rounded"
              >
                Not now — browse matchmaking
              </Link>
            </>
          )}

          {state.phase === "joining" && (
            <>
              <div className="w-6 h-6 rounded-full border-2 border-line border-t-accent-candle animate-spin mb-4" aria-label="Entering room" />
              <p className="text-sm text-muted" aria-live="polite">Lighting the room…</p>
            </>
          )}

          {state.phase === "own_link" && (
            <>
              <p className="font-display text-xl mb-2">This is your link</p>
              <p className="text-sm text-muted mb-6 max-w-xs">
                You made this invitation. Share it with someone — or start a room yourself from matchmaking.
              </p>
              <Link
                href="/matchmake"
                className="w-full max-w-xs h-[48px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-accent-foreground text-sm font-semibold flex items-center justify-center ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
              >
                Back to Matchmaking
              </Link>
            </>
          )}

          {state.phase === "expired" && (
            <>
              <p className="font-display text-xl mb-2">This invitation expired</p>
              <p className="text-sm text-muted mb-6 max-w-xs">
                One-day links close on schedule. Ask your host for a fresh one.
              </p>
              <Link
                href="/matchmake"
                className="w-full max-w-xs h-[48px] rounded-full border border-line text-foreground hover:border-accent-candle/40 hover:text-accent-candle flex items-center justify-center text-sm ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
              >
                Find your own scene
              </Link>
            </>
          )}

          {state.phase === "revoked" && (
            <>
              <p className="font-display text-xl mb-2">This invitation was revoked</p>
              <p className="text-sm text-muted mb-6 max-w-xs">
                The host turned this link off. If that surprises you, ask them what changed.
              </p>
              <Link
                href="/matchmake"
                className="w-full max-w-xs h-[48px] rounded-full border border-line text-foreground hover:border-accent-candle/40 hover:text-accent-candle flex items-center justify-center text-sm ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
              >
                Find your own scene
              </Link>
            </>
          )}

          {state.phase === "invalid" && (
            <>
              <p className="font-display text-xl mb-2">Invitation not found</p>
              <p className="text-sm text-muted mb-6 max-w-xs">
                This link doesn&rsquo;t match any room. Check that you copied the whole thing.
              </p>
              <Link
                href="/matchmake"
                className="w-full max-w-xs h-[48px] rounded-full border border-line text-foreground hover:border-accent-candle/40 hover:text-accent-candle flex items-center justify-center text-sm ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
              >
                Find your own scene
              </Link>
            </>
          )}

          {state.phase === "error" && (
            <>
              <p className="font-display text-xl mb-2">Something interrupted the night</p>
              <p className="text-sm text-muted mb-6 max-w-xs">{state.message}</p>
              <button
                onClick={() => setState({ phase: "checking" })}
                className="w-full max-w-xs h-[48px] rounded-full border border-line text-foreground hover:border-accent-candle/40 hover:text-accent-candle text-sm ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
