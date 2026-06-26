"use client";

import { useState } from "react";

type FadeToBlackProps = {
  matchId: string;
  isRevealed: boolean;
  partnerRevealed: boolean;
  partnerMovedOn: boolean;
  onReveal: () => void;
  onMoveOn: () => void;
};

/**
 * Cinematic fade-to-black overlay shown when a match ends. Presents the
 * user with the choice to reveal their identity or move on, with distinct
 * visual states for waiting, mutual reveal, rejection, and moving on.
 */
export default function FadeToBlack({
  matchId,
  isRevealed,
  partnerRevealed,
  partnerMovedOn,
  onReveal,
  onMoveOn,
}: FadeToBlackProps) {
  const [userMovedOn, setUserMovedOn] = useState(false);

  function handleMoveOn() {
    setUserMovedOn(true);
  }

  function renderContent() {
    // --- State E: user chose to move on ---
    if (userMovedOn) {
      return (
        <>
          <p className="text-gray-500 text-sm italic">
            You chose to move on.
          </p>
          <div className="mt-8">
            <button
              type="button"
              onClick={onMoveOn}
              className="bg-white/5 border border-white/10 text-gray-400 px-6 py-3 rounded-xl hover:bg-white/10 hover:text-gray-300 active:scale-95 transform transition-all duration-300 text-sm"
            >
              Close
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
            <p className="text-gray-200 text-lg font-light">
              They chose to reveal too.
            </p>
          </div>
          <p className="text-gray-500 text-sm mt-3">
            Taking you to your private room...
          </p>
        </>
      );
    }

    // --- State D: user revealed but partner moved on ---
    if (isRevealed && partnerMovedOn) {
      return (
        <>
          <p className="text-gray-500 text-lg font-light italic">
            They weren&apos;t ready yet.
          </p>
          <p className="text-gray-700 text-sm mt-3">
            Sometimes the fog doesn&apos;t lift.
          </p>
          <div className="mt-8">
            <button
              type="button"
              onClick={onMoveOn}
              className="bg-white/5 border border-white/10 text-gray-400 px-6 py-3 rounded-xl hover:bg-white/10 hover:text-gray-300 active:scale-95 transform transition-all duration-300 text-sm"
            >
              Close
            </button>
          </div>
        </>
      );
    }

    // --- State B: user revealed, waiting for partner ---
    if (isRevealed) {
      return (
        <>
          <p className="text-gray-400 text-sm">
            You chose to reveal. Waiting for them...
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span
              className="block w-2 h-2 rounded-full bg-purple-400"
              style={{
                animation: "typingBounce 1.4s infinite ease-in-out",
                animationDelay: "0s",
              }}
            />
            <span
              className="block w-2 h-2 rounded-full bg-purple-400"
              style={{
                animation: "typingBounce 1.4s infinite ease-in-out",
                animationDelay: "0.2s",
              }}
            />
            <span
              className="block w-2 h-2 rounded-full bg-purple-400"
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
        <div className="bg-gradient-to-r from-transparent via-purple-500/30 to-transparent h-px w-48 mx-auto my-8" />
        <p className="text-lg text-gray-400 font-light mb-10">
          Do you want to see who they really are?
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {/* REVEAL button */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onReveal}
              className="px-8 py-4 rounded-xl font-medium text-base text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 active:scale-95 transform transition-all duration-300"
            >
              Reveal Myself
            </button>
            <span className="text-xs text-purple-300/50">
              They&apos;ll see your anonymous profile
            </span>
          </div>

          {/* MOVE ON button */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={handleMoveOn}
              className="px-8 py-4 rounded-xl font-medium text-base text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-gray-300 active:scale-95 transform transition-all duration-300"
            >
              Move On
            </button>
            <span className="text-xs text-gray-600">
              Part ways without revealing
            </span>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center min-h-screen text-center px-6 overflow-hidden"
      style={{
        background: "black",
        animation: "fadeToBlack 2s ease-in-out forwards",
      }}
    >
      {/* vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.8)_70%)]" />

      {/* content */}
      <div
        className="relative z-10 flex flex-col items-center"
        style={{
          animation: "fadeContentIn 1.5s ease-out 1.5s forwards",
          opacity: 0,
        }}
      >
        {/* decorative diamond */}
        <span
          className="block text-purple-500/40 text-sm mb-6"
          style={{ animation: "breathGlow 3s infinite ease-in-out" }}
        >
          &#9670;
        </span>

        {/* narrative heading */}
        <h1 className="text-3xl md:text-4xl font-light tracking-wider text-gray-300 italic">
          The scene fades to black.
        </h1>
        <p className="text-base text-gray-600 font-light mt-3">
          The moment has passed. The fog settles.
        </p>

        {renderContent()}
      </div>

      {/* footer */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-30">
        <span className="text-[10px] text-gray-800 tracking-wider font-mono">
          Match ID: {matchId}
        </span>
      </div>

      <style jsx>{`
        @keyframes fadeToBlack {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes fadeContentIn {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

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
    </div>
  );
}
