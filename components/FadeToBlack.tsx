"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { submitMatchRating, type Vibe as VibeType, type RatingReason } from "@/lib/actions/ratings";

type FadeToBlackProps = {
  matchId: string;
  isRevealed: boolean;
  partnerRevealed: boolean;
  partnerMovedOn: boolean;
  isAiMatch: boolean;
  onReveal: () => void;
  onMoveOn: () => void;
  onVibeCheckComplete: () => void;
};

/**
 * Cinematic fade-to-black overlay shown when a match ends. Presents the
 * user with the choice to reveal their identity or move on, with distinct
 * visual states for waiting, mutual reveal, rejection, and moving on.
 *
 * Phase 6: After the reveal/move-on outcome is shown, a "Rate this scene"
 * button transitions to the Vibe Check second screen — 4 emoji vibes,
 * optional one-word tags, + a reason dropdown. Submitting the rating
 * calls submitMatchRating, then "Continue" routes the user to /dm or
 * /lobby via the onVibeCheckComplete callback.
 *
 * Phase 7 re-audit: AI matches don't have a human partner to reveal to,
 * so the Reveal button is hidden when isAiMatch=true. The user only sees
 * "Move On" → Vibe Check → /lobby.
 */
export default function FadeToBlack({
  matchId,
  isRevealed,
  partnerRevealed,
  partnerMovedOn,
  isAiMatch,
  onReveal,
  onMoveOn,
  onVibeCheckComplete,
}: FadeToBlackProps) {
  const [userMovedOn, setUserMovedOn] = useState(false);
  const [showVibeCheck, setShowVibeCheck] = useState(false);
  const [vibeRating, setVibeRating] = useState<VibeType | null>(null);
  const [vibeTags, setVibeTags] = useState<string[]>([]);
  const [vibeReason, setVibeReason] = useState<RatingReason>("mutual_end");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  /* Persist the decision, don't just render it. This previously only
     called setUserMovedOn, so the move_on RPC never fired from the
     primary button — user_a_moved_on / user_b_moved_on stayed false and
     the partner was never told the scene had ended. The only path that
     reached the server was the secondary "Skip and close" link. */
  function handleMoveOn() {
    setUserMovedOn(true);
    onMoveOn();
  }

  /* Whether to show the "Rate this scene" button. It appears when the
     reveal/move-on flow has reached a terminal state. */
  const terminalReached =
    (isRevealed && partnerRevealed) ||
    (isRevealed && partnerMovedOn) ||
    userMovedOn;

  async function handleSubmitVibe() {
    if (!vibeRating) {
      setError("Pick a vibe first");
      return;
    }

    setSubmitting(true);
    setError("");

    const result = await submitMatchRating(matchId, {
      vibe: vibeRating,
      tags: vibeTags.filter((t) => t.trim().length > 0),
      reason: vibeReason,
      wantsReveal: isRevealed,
    });

    setSubmitting(false);

    if ("error" in result) {
      setError(result.error);
    } else {
      setSubmitted(true);
    }
  }

  function renderVibeCheck() {
    if (submitted) {
      return (
        <>
          <p className="text-foreground-dim text-lg font-light mt-4">
            Thanks for rating.
          </p>
          <p className="text-muted-faint text-sm mt-2">
            Your reputation helps us match you better.
          </p>
          <div className="mt-8">
            <button
              type="button"
              onClick={onVibeCheckComplete}
              className="bg-gradient-to-r from-brand-dark to-pink-600 text-white font-medium px-8 py-3 rounded-xl hover:from-brand hover:to-pink-500 active:scale-95 transform transition-all duration-300 text-sm"
            >
              {isRevealed && partnerRevealed ? "Continue to DM &rarr;" : "Close &rarr;"}
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <p className="text-lg text-foreground-dim font-light mb-2 mt-4">
          How was the scene?
        </p>
        <p className="text-xs text-muted-faint mb-6">Rate your experience before you go.</p>

        {/* vibe emoji picker */}
        <div className="flex items-center justify-center gap-6 mb-6">
          {([
            { v: "electric" as const, emoji: "\uD83D\uDD25", label: "Electric" },
            { v: "warm" as const, emoji: "\uD83D\uDE0A", label: "Warm" },
            { v: "neutral" as const, emoji: "\uD83D\uDE10", label: "Neutral" },
            { v: "cold" as const, emoji: "\uD83E\uDD76", label: "Cold" },
          ]).map(({ v, emoji, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => setVibeRating(v)}
              className={[
                "flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all duration-200",
                vibeRating === v
                  ? "border-brand/50 bg-brand/10 scale-110"
                  : "border-white/10 bg-white/5 hover:border-white/20",
              ].join(" ")}
            >
              <span className="text-3xl">{emoji}</span>
              <span className="text-[10px] text-muted">{label}</span>
            </button>
          ))}
        </div>

        {/* reason dropdown */}
        <div className="mb-4">
          <p className="text-xs text-muted-faint mb-2">Why did it end?</p>
          <select
            value={vibeReason}
            onChange={(e) => setVibeReason(e.target.value as RatingReason)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-foreground-dim focus:outline-none focus:ring-2 focus:ring-brand/50 cursor-pointer"
          >
            <option value="mutual_end">Mutual end</option>
            <option value="good_end">Good ending</option>
            <option value="partner_afk">Partner went AFK</option>
            <option value="boring">It was boring</option>
            <option value="i_left">I left</option>
          </select>
        </div>

        {/* optional tags */}
        <div className="mb-4">
          <p className="text-xs text-muted-faint mb-2">
            Optional: tag the vibe (up to 3 words)
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {vibeTags.map((tag, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => {
                    const next = [...vibeTags];
                    next[i] = e.target.value.slice(0, 20);
                    setVibeTags(next);
                  }}
                  placeholder="word"
                  className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-foreground-dim focus:outline-none focus:ring-1 focus:ring-brand/50"
                />
                <button
                  type="button"
                  onClick={() => setVibeTags(vibeTags.filter((_, idx) => idx !== i))}
                  className="text-xs text-muted-faint hover:text-red-400 transition-colors"
                >
                  &times;
                </button>
              </div>
            ))}
            {vibeTags.length < 3 && (
              <button
                type="button"
                onClick={() => setVibeTags([...vibeTags, ""])}
                className="text-xs text-brand-light hover:text-brand-lighter transition-colors px-2 py-1"
              >
                + tag
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}

        {/* submit */}
        <button
          type="button"
          onClick={handleSubmitVibe}
          disabled={submitting || !vibeRating}
          className="bg-gradient-to-r from-brand-dark to-pink-600 text-white font-medium px-8 py-3 rounded-xl hover:from-brand hover:to-pink-500 active:scale-95 transform transition-all duration-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : "Submit Rating"}
        </button>

        {/* skip */}
        <button
          type="button"
          onClick={onVibeCheckComplete}
          className="block text-xs text-muted-faint hover:text-muted-strong transition-colors mt-4"
        >
          Skip and continue
        </button>
      </>
    );
  }

  function renderContent() {
    // ── Vibe Check second screen ──
    if (showVibeCheck) {
      return (
        <AnimatePresence mode="wait">
          <motion.div
            key="vibe-check"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
          >
            {renderVibeCheck()}
          </motion.div>
        </AnimatePresence>
      );
    }

    // --- State E: user chose to move on ---
    if (userMovedOn) {
      return (
        <>
          <p className="text-muted text-sm italic">
            You chose to move on.
          </p>
          {terminalReached && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowVibeCheck(true)}
                className="bg-white/5 border border-white/10 text-brand-light px-6 py-3 rounded-xl hover:bg-white/10 active:scale-95 transform transition-all duration-300 text-sm"
              >
                Rate this scene &rarr;
              </button>
            </div>
          )}
          <div className="mt-4">
            {/* Closes without rating. This used to call onMoveOn, which
                re-fired the move_on RPC and closed nothing — the overlay
                stayed up with no way out. onVibeCheckComplete is the
                route-away callback. */}
            <button
              type="button"
              onClick={onVibeCheckComplete}
              className="text-xs text-muted-faint hover:text-muted-strong transition-colors"
            >
              Skip and close
            </button>
          </div>
        </>
      );
    }

    // --- State C: both revealed ---
    if (isRevealed && partnerRevealed) {
      return (
        <>
          <div className="relative">
            {/* celebration glow */}
            <div
              className="absolute inset-0 -z-10 rounded-full blur-2xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 70%)",
                animation: "glowExpand 2s ease-in-out infinite alternate",
              }}
            />
            <p className="text-foreground text-lg font-light">
              They chose to reveal too.
            </p>
          </div>
          {terminalReached && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowVibeCheck(true)}
                className="bg-white/5 border border-white/10 text-brand-light px-6 py-3 rounded-xl hover:bg-white/10 active:scale-95 transform transition-all duration-300 text-sm"
              >
                Rate this scene &rarr;
              </button>
            </div>
          )}
        </>
      );
    }

    // --- State D: user revealed but partner moved on ---
    if (isRevealed && partnerMovedOn) {
      return (
        <>
          <p className="text-muted text-lg font-light italic">
            They weren&apos;t ready yet.
          </p>
          <p className="text-muted-faint text-sm mt-3">
            Sometimes the fog doesn&apos;t lift.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowVibeCheck(true)}
              className="bg-white/5 border border-white/10 text-brand-light px-6 py-3 rounded-xl hover:bg-white/10 active:scale-95 transform transition-all duration-300 text-sm"
            >
              Rate this scene &rarr;
            </button>
          </div>
        </>
      );
    }

    // --- State B: user revealed, waiting for partner ---
    if (isRevealed) {
      return (
        <>
          <p className="text-muted-strong text-sm">
            You chose to reveal. Waiting for them...
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span
              className="block w-2 h-2 rounded-full bg-brand-light"
              style={{
                animation: "typingBounce 1.4s infinite ease-in-out",
                animationDelay: "0s",
              }}
            />
            <span
              className="block w-2 h-2 rounded-full bg-brand-light"
              style={{
                animation: "typingBounce 1.4s infinite ease-in-out",
                animationDelay: "0.2s",
              }}
            />
            <span
              className="block w-2 h-2 rounded-full bg-brand-light"
              style={{
                animation: "typingBounce 1.4s infinite ease-in-out",
                animationDelay: "0.4s",
              }}
            />
          </div>
          <div className="mt-4 text-2xl opacity-50 select-none">
            <span style={{ animation: "slowSpin 4s linear infinite", display: "inline-block" }}>
              &#9203;
            </span>
          </div>
        </>
      );
    }

    // --- State A: initial choice ---
    return (
      <>
        <div className="bg-gradient-to-r from-transparent via-brand/30 to-transparent h-px w-48 mx-auto my-8" />
        <p className="text-lg text-muted-strong font-light mb-10">
          {isAiMatch
            ? "The scene has ended."
            : "Do you want to see who they really are?"}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {/* REVEAL button — hidden for AI matches (no human partner). */}
          {!isAiMatch && (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={onReveal}
                className="px-8 py-4 rounded-xl font-medium text-base text-white bg-gradient-to-r from-brand-dark to-pink-600 hover:from-brand hover:to-pink-500 active:scale-95 transform transition-all duration-300"
              >
                Reveal Myself
              </button>
              <span className="text-xs text-brand-lighter/50">
                They&apos;ll see your anonymous profile
              </span>
            </div>
          )}

          {/* MOVE ON button */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={handleMoveOn}
              className="px-8 py-4 rounded-xl font-medium text-base text-muted-strong bg-white/5 border border-white/10 hover:bg-white/10 hover:text-foreground-dim active:scale-95 transform transition-all duration-300"
            >
              {isAiMatch ? "Continue" : "Move On"}
            </button>
            <span className="text-xs text-muted-faint">
              {isAiMatch ? "Rate the scene and leave" : "Part ways without revealing"}
            </span>
          </div>
        </div>
      </>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center min-h-screen text-center px-6 overflow-hidden"
      style={{ background: "black" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 2, ease: "easeInOut" }}
    >
      {/* vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.8)_70%)]" />

      {/* content */}
      <motion.div
        className="relative z-10 flex flex-col items-center max-w-md w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, delay: 1.5, ease: "easeOut" }}
      >
        {/* decorative diamond */}
        <span
          className="block text-brand/40 text-sm mb-6"
          style={{ animation: "breathGlow 3s infinite ease-in-out" }}
        >
          &#9670;
        </span>

        {/* narrative heading */}
        <h1 className="text-3xl md:text-4xl font-light tracking-wider text-foreground-dim italic">
          The scene fades to black.
        </h1>
        <p className="text-base text-muted-faint font-light mt-3">
          The moment has passed. The fog settles.
        </p>

        {renderContent()}
      </motion.div>

      {/* footer */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-30">
        <span className="text-[10px] text-muted-faint tracking-wider font-mono">
          Match ID: {matchId}
        </span>
      </div>

      <style jsx>{`
        @keyframes breathGlow {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.15);
          }
        }

        @keyframes slowSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes typingBounce {
          0%,
          80%,
          100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          40% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }

        @keyframes glowExpand {
          0% {
            transform: scale(0.8);
            opacity: 0.3;
          }
          100% {
            transform: scale(1.2);
            opacity: 0.6;
          }
        }
      `}</style>
    </motion.div>
  );
}