"use client";

import { useState } from "react";
import Link from "next/link";
import { useMounted } from "@/lib/utils/useMounted";
import { useStoredFlag, notifyFlagChange } from "@/lib/utils/useStoredFlag";
import TurnstileWidget from "@/components/TurnstileWidget";

/**
 * Homepage of the chatty platform. Renders an 18+ age gate on first visit
 * (persisted via localStorage), then the full cinematic landing page with
 * hero, how-it-works steps, scenario showcase, VIP teaser, and footer.
 */
export default function Home() {
  const ageVerified = useStoredFlag("chatty_age_verified");
  const mounted = useMounted();
  const [goodbyeClicked, setGoodbyeClicked] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  function handleVerify() {
    localStorage.setItem("chatty_age_verified", "true");
    notifyFlagChange();
  }

  function handleDecline() {
    setGoodbyeClicked(true);
    setTimeout(() => {
      window.location.href = "https://www.google.com";
    }, 1500);
  }

  if (!mounted) return null;

  /* ───────────────────────────────────────────────
   * AGE GATE
   * ─────────────────────────────────────────────── */
  if (!ageVerified) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
        {/* floating particles */}
        {[...Array(8)].map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-purple-500/20"
            style={{
              width: `${4 + (i % 3) * 4}px`,
              height: `${4 + (i % 3) * 4}px`,
              left: `${10 + (i * 12) % 80}%`,
              animation: `floatUp ${12 + (i % 6)}s ${i * 1.5}s infinite linear`,
              opacity: 0,
            }}
          />
        ))}

        <div
          className="relative z-10 flex flex-col items-center text-center px-6"
          style={{ animation: "slowFade 2s ease-in-out forwards" }}
        >
          <span className="text-xs tracking-[0.4em] text-purple-500/60 uppercase">
            CHatty
          </span>

          <div className="w-16 mx-auto my-6 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

          <h1 className="text-2xl font-light text-gray-300">
            Are you 18 or older?
          </h1>

          <p className="text-sm text-gray-600 max-w-md mt-3 leading-relaxed">
            This platform contains mature content. By entering, you confirm
            you are of legal age.
          </p>

          <div className="flex items-center gap-3 mt-8">
            <button
              type="button"
              onClick={handleVerify}
              disabled={
                !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
                !turnstileToken
              }
              className="px-8 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 active:scale-95 transform transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Yes
            </button>
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={handleDecline}
                className="px-8 py-3 rounded-xl font-medium text-gray-500 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transform transition-all duration-300"
              >
                No
              </button>
              {goodbyeClicked && (
                <span className="text-xs text-gray-600 mt-1">Goodbye.</span>
              )}
            </div>
          </div>

          {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <div className="mt-6">
              <TurnstileWidget
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                onVerify={setTurnstileToken}
              />
            </div>
          )}
        </div>

        <style jsx>{`
          @keyframes slowFade {
            0% {
              opacity: 0;
            }
            100% {
              opacity: 1;
            }
          }
          @keyframes floatUp {
            0% {
              transform: translateY(100vh);
              opacity: 0;
            }
            10% {
              opacity: 0.8;
            }
            90% {
              opacity: 0.3;
            }
            100% {
              transform: translateY(-10vh);
              opacity: 0;
            }
          }
        `}</style>
      </div>
    );
  }

  /* ───────────────────────────────────────────────
   * LANDING PAGE
   * ─────────────────────────────────────────────── */
  return (
    <main className="bg-black text-white min-h-screen">
      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_30%,rgba(88,28,135,0.15)_0%,transparent_60%)]" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <span
            className="text-xs tracking-[0.5em] text-purple-500/50 uppercase"
            style={{ animation: "slowFade 1.5s ease-in-out forwards", opacity: 0 }}
          >
            ANONYMOUS &bull; UNCENSORED &bull; UNFORGETTABLE
          </span>

          <h1
            className="text-7xl md:text-8xl font-bold tracking-tight mt-4 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent"
            style={{ animation: "breathScale 4s infinite alternate ease-in-out" }}
          >
            chatty
          </h1>

          <p
            className="text-2xl font-light text-gray-400 italic mt-2"
            style={{
              animation: "slowFade 2s ease-in-out forwards",
              animationDelay: "0.8s",
              opacity: 0,
            }}
          >
            Match. Roleplay. Reveal.
          </p>

          <p
            className="text-base text-gray-500 max-w-lg mt-6 leading-relaxed"
            style={{
              animation: "slowFade 2s ease-in-out forwards",
              animationDelay: "1.4s",
              opacity: 0,
            }}
          >
            An anonymous roleplay dating platform where two strangers meet
            inside a shared scene. An AI director breaks the ice. You
            decide if the fog lifts.
          </p>

          <div
            className="mt-10 flex flex-col items-center gap-3"
            style={{
              animation: "slowFade 2s ease-in-out forwards",
              animationDelay: "2s",
              opacity: 0,
            }}
          >
            <Link
              href="/lobby"
              className="px-8 py-4 rounded-xl font-medium text-lg text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 active:scale-95 transform transition-all duration-300 inline-flex items-center gap-2"
            >
              Enter the Lobby <span>&rarr;</span>
            </Link>
            <Link
              href="/characters"
              className="text-sm text-gray-500 hover:text-gray-300 mt-1 underline-offset-4 hover:underline transition-all"
            >
              Browse Characters
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-6 bg-gradient-to-b from-black to-purple-950/10">
        <h2 className="text-3xl font-light text-gray-300 text-center mb-16 tracking-wide">
          How It Works
        </h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {/* Step 1 */}
          <div
            className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center hover:border-purple-500/30 transition-all duration-300"
            style={{
              animation: "slowFade 2s ease-in-out forwards",
              animationDelay: "0.2s",
              opacity: 0,
            }}
          >
            <span className="block text-4xl mb-4">&#x1F52E;</span>
            <h3 className="text-lg text-gray-200 font-light mb-3">
              Match Anonymously
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Pick your scenario, spend your tokens, and get matched with a
              stranger — or our AI.
            </p>
          </div>

          {/* Step 2 */}
          <div
            className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center hover:border-purple-500/30 transition-all duration-300"
            style={{
              animation: "slowFade 2s ease-in-out forwards",
              animationDelay: "0.4s",
              opacity: 0,
            }}
          >
            <span className="block text-4xl mb-4">&#x1F3AD;</span>
            <h3 className="text-lg text-gray-200 font-light mb-3">
              Roleplay Together
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              An AI director joins your chat, breaks the ice, and keeps the
              scene alive. Every 6 messages, the AI steps in.
            </p>
          </div>

          {/* Step 3 */}
          <div
            className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center hover:border-purple-500/30 transition-all duration-300"
            style={{
              animation: "slowFade 2s ease-in-out forwards",
              animationDelay: "0.6s",
              opacity: 0,
            }}
          >
            <span className="block text-4xl mb-4">&#x1F32B;&#xFE0F;</span>
            <h3 className="text-lg text-gray-200 font-light mb-3">
              Reveal or Fade
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              When the tokens run out, the scene fades to black. Both must
              agree to reveal. Or part ways in the mist.
            </p>
          </div>
        </div>
      </section>

      {/* ── SCENARIOS ── */}
      <section className="py-24 px-6 bg-black">
        <h2 className="text-3xl font-light text-gray-300 text-center mb-16 tracking-wide">
          Step Into a Scene
        </h2>

        <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
          {[
            "Hospital",
            "Coffee Shop",
            "Mansion",
            "Library",
            "Gym",
            "Noir Office",
          ].map((scenario) => (
            <span
              key={scenario}
              className="px-6 py-3 rounded-full border border-white/10 bg-white/5 text-gray-400 text-sm hover:border-purple-500/40 hover:text-purple-300 transition-all cursor-default"
            >
              {scenario}
            </span>
          ))}
        </div>

        <p className="text-gray-600 text-sm text-center mt-8">
          More scenarios added weekly.
        </p>
      </section>

      {/* ── VIP TEASER ── */}
      <section className="py-24 px-6 bg-gradient-to-b from-purple-950/10 to-black">
        <div className="max-w-xl mx-auto bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-3xl p-10 text-center">
          <span className="text-xs font-bold tracking-widest text-pink-400 uppercase">
            VIP
          </span>

          <h2 className="text-2xl font-light text-gray-200 mt-4">
            Unlock Everything
          </h2>

          <div className="mt-6 space-y-3 text-gray-400 text-sm">
            <p className="flex items-center justify-center gap-3">
              <span>&#x2713;</span> Unlimited daily matches
            </p>
            <p className="flex items-center justify-center gap-3">
              <span>&#x2713;</span> Deep Dive tier (10k tokens)
            </p>
            <p className="flex items-center justify-center gap-3">
              <span>&#x2713;</span> 3 AI images per match
            </p>
            <p className="flex items-center justify-center gap-3">
              <span>&#x2713;</span> Priority matchmaking
            </p>
          </div>

          <p className="text-3xl font-light text-white mt-8">
            $9.99 <span className="text-lg text-gray-500">/ month</span>
          </p>

          <button
            type="button"
            className="mt-8 px-8 py-3 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 active:scale-95 transform transition-all duration-300"
          >
            Become VIP
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 px-6 border-t border-white/5 bg-black">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="text-lg text-purple-500/50 font-medium">
            chatty
          </span>

          <div className="flex items-center gap-4">
            <a
              href="#"
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Terms
            </a>
            <a
              href="#"
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Discord
            </a>
            <a
              href="#"
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Contact
            </a>
          </div>

          <span className="text-xs text-gray-700">
            &copy; 2025 chatty. All scenes reserved.
          </span>
        </div>
      </footer>

      {/* ── GLOBAL KEYFRAMES ── */}
      <style jsx>{`
        @keyframes slowFade {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes breathScale {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(1.02);
          }
        }
        @keyframes floatUp {
          0% {
            transform: translateY(100vh);
            opacity: 0;
          }
          10% {
            opacity: 0.8;
          }
          90% {
            opacity: 0.3;
          }
          100% {
            transform: translateY(-10vh);
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}
