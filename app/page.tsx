"use client";

import { useState } from "react";
import Link from "next/link";
import { useMounted } from "@/lib/utils/useMounted";
import { useStoredFlag, notifyFlagChange } from "@/lib/utils/useStoredFlag";
import TurnstileWidget from "@/components/TurnstileWidget";
import { MIN_PLATFORM_AGE } from "@/lib/config/constants";

/**
 * Homepage of the sweetscene platform. Renders a 16+ age gate (birthday
 * picker) on first visit (persisted via localStorage), then the full
 * cinematic landing page with hero, how-it-works steps, scenario
 * showcase, VIP teaser, and footer.
 *
 * The gate here is UX only and carries no security weight — see the
 * note in handleVerify.
 */
export default function Home() {
  const ageVerified = useStoredFlag("sweetscene_age_verified");
  const mounted = useMounted();
  const [goodbyeClicked, setGoodbyeClicked] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [ageError, setAgeError] = useState("");

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  /**
   * Calculates age from the selected birthday. Returns -1 if the date
   * is invalid or in the future.
   */
  function calculateAge(): number {
    const month = parseInt(birthMonth, 10);
    const day = parseInt(birthDay, 10);
    const year = parseInt(birthYear, 10);

    if (!month || !day || !year) return -1;

    const birth = new Date(year, month - 1, day);
    if (birth.getMonth() !== month - 1 || birth.getDate() !== day) return -1;

    const now = new Date();
    let age = now.getFullYear() - year;
    if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) {
      age--;
    }
    return age;
  }

  /**
   * The selected birthday as an ISO `YYYY-MM-DD` string, or "" if the
   * fields are incomplete. Sent verbatim to the server, which recomputes
   * the age itself — this value is a claim, not a verdict.
   */
  function birthdateISO(): string {
    const month = parseInt(birthMonth, 10);
    const day = parseInt(birthDay, 10);
    const year = parseInt(birthYear, 10);
    if (!month || !day || !year) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function handleVerify() {
    const age = calculateAge();
    if (age < 0) {
      setAgeError("Please enter a valid date of birth.");
      return;
    }
    if (age < MIN_PLATFORM_AGE) {
      setGoodbyeClicked(true);
      setAgeError(`You must be ${MIN_PLATFORM_AGE} or older to use this platform.`);
      setTimeout(() => {
        window.location.assign("https://www.google.com");
      }, 2000);
      return;
    }

    /* SECURITY: this pre-auth gate is UX only — localStorage and any
       cookie set here are fully user-controlled and are NOT trusted for
       anything. The binding record is the birthdate submitted after
       sign-in via submitBirthdate() -> set_own_age_cohort, which
       computes the age in SQL. Do not reintroduce a cohort cookie: the
       previous version of this file wrote `sweetscene_age_cohort`, which the
       OAuth callback fed to a service-role RPC, making the 18+ NSFW gate
       bypassable from devtools. Stash the DOB for the post-auth step. */
    sessionStorage.setItem("sweetscene_pending_dob", birthdateISO());

    localStorage.setItem("sweetscene_age_verified", "true");
    notifyFlagChange();
  }

  function handleDecline() {
    setGoodbyeClicked(true);
    setTimeout(() => {
      window.location.assign("https://www.google.com");
    }, 1500);
  }

  if (!mounted) return null;

  /* ───────────────────────────────────────────────
   * AGE GATE — Birthday picker (16+ floor)
   * ─────────────────────────────────────────────── */
  if (!ageVerified) {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
    const daysInMonth = birthMonth
      ? new Date(parseInt(String(birthYear || currentYear), 10), parseInt(String(birthMonth), 10), 0).getDate()
      : 31;
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
        {/* floating particles */}
        {[...Array(8)].map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-brand/20"
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
          <span className="text-xs tracking-[0.4em] text-brand/60 uppercase">
            SWeetscene
          </span>

          <div className="w-16 mx-auto my-6 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />

          <h1 className="text-2xl font-light text-foreground-dim">
            Enter the fog
          </h1>

          <p className="text-sm text-muted-faint max-w-md mt-3 leading-relaxed">
            This platform contains mature content. Please verify your date of
            birth to continue. You must be {MIN_PLATFORM_AGE} or older.
          </p>

          {/* Birthday picker */}
          <div className="flex items-center gap-2 mt-6">
            <select
              aria-label="Birth month"
              value={birthMonth}
              onChange={(e) => setBirthMonth(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              aria-label="Birth day"
              value={birthDay}
              onChange={(e) => setBirthDay(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              <option value="">Day</option>
              {days.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              aria-label="Birth year"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              <option value="">Year</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {ageError && (
            <p className="text-xs text-red-400 mt-3">{ageError}</p>
          )}

          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={handleVerify}
              disabled={
                !birthMonth ||
                !birthDay ||
                !birthYear ||
                (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken)
              }
              className="px-8 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-brand-dark to-pink-600 hover:from-brand hover:to-pink-500 active:scale-95 transform transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Enter
            </button>
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={handleDecline}
                className="px-8 py-3 rounded-xl font-medium text-muted bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transform transition-all duration-300"
              >
                Leave
              </button>
              {goodbyeClicked && (
                <span className="text-xs text-muted-faint mt-1">Goodbye.</span>
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

          <p className="text-xs text-muted-faint mt-6">
            By entering, you agree to our{" "}
            <a href="/legal/terms" className="text-brand/60 hover:text-brand-light underline">
              Terms
            </a>{" "}
            and{" "}
            <a href="/legal/privacy" className="text-brand/60 hover:text-brand-light underline">
              Privacy Policy
            </a>
            .
          </p>
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
            className="text-xs tracking-[0.5em] text-brand/50 uppercase"
            style={{ animation: "slowFade 1.5s ease-in-out forwards", opacity: 0 }}
          >
            ANONYMOUS &bull; UNCENSORED &bull; UNFORGETTABLE
          </span>

          <h1
            className="text-7xl md:text-8xl font-bold tracking-tight mt-4 bg-gradient-to-r from-brand-light via-pink-400 to-brand-light bg-clip-text text-transparent"
            style={{ animation: "breathScale 4s infinite alternate ease-in-out" }}
          >
            sweetscene
          </h1>

          <p
            className="text-2xl font-light text-muted-strong italic mt-2"
            style={{
              animation: "slowFade 2s ease-in-out forwards",
              animationDelay: "0.8s",
              opacity: 0,
            }}
          >
            Match. Roleplay. Reveal.
          </p>

          <p
            className="text-base text-muted max-w-lg mt-6 leading-relaxed"
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
              className="px-8 py-4 rounded-xl font-medium text-lg text-white bg-gradient-to-r from-brand-dark to-pink-600 hover:from-brand hover:to-pink-500 active:scale-95 transform transition-all duration-300 inline-flex items-center gap-2"
            >
              Enter the Lobby <span>&rarr;</span>
            </Link>
            <Link
              href="/characters"
              className="text-sm text-muted hover:text-foreground-dim mt-1 underline-offset-4 hover:underline transition-all"
            >
              Browse Characters
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-6 bg-gradient-to-b from-black to-brand-deepest/10">
        <h2 className="text-3xl font-light text-foreground-dim text-center mb-16 tracking-wide">
          How It Works
        </h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {/* Step 1 */}
          <div
            className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center hover:border-brand/30 transition-all duration-300"
            style={{
              animation: "slowFade 2s ease-in-out forwards",
              animationDelay: "0.2s",
              opacity: 0,
            }}
          >
            <span className="block text-4xl mb-4">&#x1F52E;</span>
            <h3 className="text-lg text-foreground font-light mb-3">
              Match Anonymously
            </h3>
            <p className="text-sm text-muted-strong leading-relaxed">
              Pick your scenario, spend your tokens, and get matched with a
              stranger — or our AI.
            </p>
          </div>

          {/* Step 2 */}
          <div
            className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center hover:border-brand/30 transition-all duration-300"
            style={{
              animation: "slowFade 2s ease-in-out forwards",
              animationDelay: "0.4s",
              opacity: 0,
            }}
          >
            <span className="block text-4xl mb-4">&#x1F3AD;</span>
            <h3 className="text-lg text-foreground font-light mb-3">
              Roleplay Together
            </h3>
            <p className="text-sm text-muted-strong leading-relaxed">
              An AI director joins your chat, breaks the ice, and keeps the
              scene alive. Every 6 messages, the AI steps in.
            </p>
          </div>

          {/* Step 3 */}
          <div
            className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center hover:border-brand/30 transition-all duration-300"
            style={{
              animation: "slowFade 2s ease-in-out forwards",
              animationDelay: "0.6s",
              opacity: 0,
            }}
          >
            <span className="block text-4xl mb-4">&#x1F32B;&#xFE0F;</span>
            <h3 className="text-lg text-foreground font-light mb-3">
              Reveal or Fade
            </h3>
            <p className="text-sm text-muted-strong leading-relaxed">
              When the tokens run out, the scene fades to black. Both must
              agree to reveal. Or part ways in the mist.
            </p>
          </div>
        </div>
      </section>

      {/* ── SCENARIOS ── */}
      <section className="py-24 px-6 bg-black">
        <h2 className="text-3xl font-light text-foreground-dim text-center mb-16 tracking-wide">
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
              className="px-6 py-3 rounded-full border border-white/10 bg-white/5 text-muted-strong text-sm hover:border-brand/40 hover:text-brand-lighter transition-all cursor-default"
            >
              {scenario}
            </span>
          ))}
        </div>

        <p className="text-muted-faint text-sm text-center mt-8">
          More scenarios added weekly.
        </p>
      </section>

      {/* ── VIP TEASER ── */}
      <section className="py-24 px-6 bg-gradient-to-b from-brand-deepest/10 to-black">
        <div className="max-w-xl mx-auto bg-gradient-to-br from-brand-deep/20 to-pink-900/20 border border-brand/20 rounded-3xl p-10 text-center">
          <span className="text-xs font-bold tracking-widest text-pink-400 uppercase">
            VIP
          </span>

          <h2 className="text-2xl font-light text-foreground mt-4">
            Unlock Everything
          </h2>

          <div className="mt-6 space-y-3 text-muted-strong text-sm">
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
            $9.99 <span className="text-lg text-muted">/ month</span>
          </p>

          <Link
            href="/login"
            className="mt-8 px-8 py-3 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-brand-dark to-pink-600 hover:from-brand hover:to-pink-500 active:scale-95 transform transition-all duration-300 inline-block"
          >
            Become VIP
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 px-6 border-t border-white/5 bg-black">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="text-lg text-brand/50 font-medium">
            sweetscene
          </span>

          <div className="flex items-center gap-4">
            <a
              href="/legal/privacy"
              className="text-xs text-muted-faint hover:text-muted-strong transition-colors"
            >
              Privacy
            </a>
            <a
              href="/legal/terms"
              className="text-xs text-muted-faint hover:text-muted-strong transition-colors"
            >
              Terms
            </a>
            <a
              href="https://discord.gg/sweetscene"
              className="text-xs text-muted-faint hover:text-muted-strong transition-colors"
            >
              Discord
            </a>
            <a
              href="mailto:support@sweetscene.app"
              className="text-xs text-muted-faint hover:text-muted-strong transition-colors"
            >
              Contact
            </a>
          </div>

          <span className="text-xs text-muted-faint">
            &copy; 2025 sweetscene. All scenes reserved.
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
