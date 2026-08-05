"use client";

import { useState } from "react";
import { useMounted } from "@/lib/utils/useMounted";
import { useStoredFlag, notifyFlagChange } from "@/lib/utils/useStoredFlag";
import TurnstileWidget from "@/components/TurnstileWidget";
import { MIN_PLATFORM_AGE } from "@/lib/config/constants";
import { motion, AnimatePresence } from "framer-motion";
import { HeroSection } from "@/components/landing/HeroSection";
import { ImageGrid } from "@/components/landing/ImageGrid";
import { Marquee } from "@/components/landing/Marquee";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";
import Link from "next/link";

/**
 * Homepage of the sweetscene platform.
 *
 * First visit: renders a full-screen age gate (birthday picker, 16+ floor).
 * Gate is UX-only — security gate lives server-side in AgeCohortGate +
 * Supabase RPCs. The DOB is stashed in sessionStorage for the post-auth
 * set_own_age_cohort call; no cohort cookie is written (see handleVerify
 * comment for history).
 *
 * After gate: renders the immersive landing page — hero with flanking
 * image columns, horizontal image marquee, how-it-works, image grid,
 * VIP teaser, and footer.
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
    if (
      now.getMonth() < month - 1 ||
      (now.getMonth() === month - 1 && now.getDate() < day)
    ) {
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
      ? new Date(
          parseInt(String(birthYear || currentYear), 10),
          parseInt(String(birthMonth), 10),
          0
        ).getDate()
      : 31;
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
        {/* Floating particles */}
        {[...Array(8)].map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
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

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full"
        >
          <span className="text-xs tracking-[0.4em] text-brand/60 uppercase">
            sweetscene
          </span>

          <div className="w-16 mx-auto my-6 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />

          <h1 className="text-2xl font-light text-foreground-dim">
            Enter the fog
          </h1>

          <p className="text-sm text-muted max-w-md mt-3 leading-relaxed">
            This platform contains mature content. Please verify your date of
            birth to continue. You must be {MIN_PLATFORM_AGE} or older.
          </p>

          {/* Birthday picker */}
          <div className="flex items-center gap-2 mt-6 flex-wrap justify-center">
            <select
              aria-label="Birth month"
              value={birthMonth}
              onChange={(e) => setBirthMonth(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 min-w-[100px]"
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
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 min-w-[72px]"
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
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 min-w-[88px]"
            >
              <option value="">Year</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <AnimatePresence>
            {ageError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-danger mt-3"
                role="alert"
              >
                {ageError}
              </motion.p>
            )}
          </AnimatePresence>

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
              className="px-8 py-3 rounded-xl font-medium text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              style={{
                background: "linear-gradient(135deg, #9333ea, #ec4899)",
                boxShadow: "0 0 20px rgba(168,85,247,0.3)",
              }}
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
            <a
              href="/legal/terms"
              className="text-brand/60 hover:text-brand-light underline"
            >
              Terms
            </a>{" "}
            and{" "}
            <a
              href="/legal/privacy"
              className="text-brand/60 hover:text-brand-light underline"
            >
              Privacy Policy
            </a>
            .
          </p>
        </motion.div>

        <style jsx>{`
          @keyframes floatUp {
            0% { transform: translateY(100vh); opacity: 0; }
            10% { opacity: 0.8; }
            90% { opacity: 0.3; }
            100% { transform: translateY(-10vh); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  /* ───────────────────────────────────────────────
   * FULL LANDING PAGE
   * ─────────────────────────────────────────────── */
  return (
    <main className="bg-black text-foreground overflow-x-hidden">
      {/* ── Hero with flanking image columns ── */}
      <HeroSection />

      {/* ── Auto-scrolling character marquee ── */}
      <Marquee />

      {/* ── How It Works ── */}
      <HowItWorks />

      {/* ── Overwhelming image grid ── */}
      <ImageGrid />

      {/* ── VIP Teaser ── */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
          className="max-w-xl mx-auto rounded-3xl p-10 text-center border border-brand/20"
          style={{
            background:
              "linear-gradient(135deg, rgba(147,51,234,0.15) 0%, rgba(236,72,153,0.10) 100%)",
            boxShadow: "0 0 60px rgba(168,85,247,0.1)",
          }}
        >
          <span className="text-xs font-bold tracking-widest text-pink-400 uppercase">
            VIP
          </span>

          <h2 className="text-2xl font-light text-foreground mt-4 text-balance">
            Unlock Everything
          </h2>

          <div className="mt-6 space-y-3 text-muted-strong text-sm">
            {[
              "Unlimited daily matches",
              "Deep Dive tier (10k tokens)",
              "3 AI images per match",
              "Priority matchmaking",
              "NSFW scenes (18+ verified)",
            ].map((perk) => (
              <p key={perk} className="flex items-center justify-center gap-3">
                <span className="text-success" aria-hidden="true">&#x2713;</span>
                {perk}
              </p>
            ))}
          </div>

          <p className="text-3xl font-light text-foreground mt-8">
            $9.99{" "}
            <span className="text-lg text-muted">/ month</span>
          </p>

          <Link
            href="/login"
            className="mt-8 px-8 py-3 rounded-xl font-medium text-sm text-white transition-all duration-300 active:scale-95 inline-block"
            style={{
              background: "linear-gradient(135deg, #9333ea, #ec4899)",
              boxShadow: "0 0 20px rgba(168,85,247,0.3)",
            }}
          >
            Become VIP
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <LandingFooter />
    </main>
  );
}
