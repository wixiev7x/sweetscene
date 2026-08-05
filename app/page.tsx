"use client";

import { useState } from "react";
import { useMounted } from "@/lib/utils/useMounted";
import { useStoredFlag, notifyFlagChange } from "@/lib/utils/useStoredFlag";
import TurnstileWidget from "@/components/TurnstileWidget";
import { MIN_PLATFORM_AGE } from "@/lib/config/constants";
import { motion, AnimatePresence } from "framer-motion";
import { ExploreSidebar } from "@/components/explore/ExploreSidebar";
import { ExploreCatalogue } from "@/components/explore/ExploreCatalogue";
import { MobileNav } from "@/components/explore/MobileNav";

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

  function calculateAge(): number {
    const month = parseInt(birthMonth, 10);
    const day = parseInt(birthDay, 10);
    const year = parseInt(birthYear, 10);
    if (!month || !day || !year) return -1;
    const birth = new Date(year, month - 1, day);
    if (birth.getMonth() !== month - 1 || birth.getDate() !== day) return -1;
    const now = new Date();
    let age = now.getFullYear() - year;
    if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) age--;
    return age;
  }

  function birthdateISO(): string {
    const month = parseInt(birthMonth, 10);
    const day = parseInt(birthDay, 10);
    const year = parseInt(birthYear, 10);
    if (!month || !day || !year) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function handleVerify() {
    const age = calculateAge();
    if (age < 0) { setAgeError("Please enter a valid date of birth."); return; }
    if (age < MIN_PLATFORM_AGE) {
      setGoodbyeClicked(true);
      setAgeError(`You must be ${MIN_PLATFORM_AGE} or older to use this platform.`);
      setTimeout(() => window.location.assign("https://www.google.com"), 2000);
      return;
    }
    sessionStorage.setItem("sweetscene_pending_dob", birthdateISO());
    localStorage.setItem("sweetscene_age_verified", "true");
    notifyFlagChange();
  }

  function handleDecline() {
    setGoodbyeClicked(true);
    setTimeout(() => window.location.assign("https://www.google.com"), 1500);
  }

  if (!mounted) return null;

  /* ─── AGE GATE ─── */
  if (!ageVerified) {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
    const daysInMonth = birthMonth
      ? new Date(parseInt(String(birthYear || currentYear), 10), parseInt(String(birthMonth), 10), 0).getDate()
      : 31;
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="fixed inset-0 z-50 bg-[#080808] flex items-center justify-center overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-[0.07]"
            style={{ background: "radial-gradient(ellipse, #e91e8c, transparent 70%)" }} />
        </div>

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <span key={i} aria-hidden="true" className="absolute rounded-full bg-brand/20"
            style={{
              width: `${4 + (i % 3) * 3}px`, height: `${4 + (i % 3) * 3}px`,
              left: `${15 + (i * 14) % 70}%`,
              animation: `floatUp ${14 + (i % 5)}s ${i * 2}s infinite linear`, opacity: 0,
            }}
          />
        ))}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full"
        >
          {/* Logo */}
          <span className="text-2xl font-bold" style={{ background: "linear-gradient(90deg,#e91e8c,#9333ea)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            sweetscene<span style={{ WebkitTextFillColor: "rgba(168,85,247,0.5)" }}>.ai</span>
          </span>

          <div className="w-12 mx-auto my-5 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />

          <h1 className="text-xl font-light text-white/80">Verify your age to continue</h1>
          <p className="text-sm text-[#555] mt-2 leading-relaxed">
            This platform contains mature content. You must be {MIN_PLATFORM_AGE}+.
          </p>

          {/* Birthday picker */}
          <div className="flex items-center gap-2 mt-6 flex-wrap justify-center">
            {[
              { label: "Birth month", value: birthMonth, onChange: setBirthMonth, opts: MONTHS.map((m, i) => ({ v: String(i + 1), l: m })), placeholder: "Month", minW: "min-w-[110px]" },
              { label: "Birth day", value: birthDay, onChange: setBirthDay, opts: days.map((d) => ({ v: String(d), l: String(d) })), placeholder: "Day", minW: "min-w-[76px]" },
              { label: "Birth year", value: birthYear, onChange: setBirthYear, opts: years.map((y) => ({ v: String(y), l: String(y) })), placeholder: "Year", minW: "min-w-[90px]" },
            ].map(({ label, value, onChange, opts, placeholder, minW }) => (
              <select
                key={label}
                aria-label={label}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`bg-[#1a1a1a] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand/50 ${minW}`}
              >
                <option value="">{placeholder}</option>
                {opts.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
          </div>

          <AnimatePresence>
            {ageError && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs text-danger mt-3" role="alert">{ageError}</motion.p>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={handleVerify}
              disabled={!birthMonth || !birthDay || !birthYear || (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken)}
              className="px-8 py-3 rounded-xl font-semibold text-white text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#9333ea,#e91e8c)", boxShadow: "0 4px 20px rgba(233,30,140,0.35)" }}
            >
              Enter
            </button>
            <div className="flex flex-col items-center">
              <button type="button" onClick={handleDecline}
                className="px-8 py-3 rounded-xl font-medium text-sm text-[#777] bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] active:scale-95 transition-all">
                Leave
              </button>
              {goodbyeClicked && <span className="text-xs text-[#444] mt-1">Goodbye.</span>}
            </div>
          </div>

          {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <div className="mt-5"><TurnstileWidget siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onVerify={setTurnstileToken} /></div>
          )}

          <p className="text-xs text-[#444] mt-5">
            By entering, you agree to our{" "}
            <a href="/legal/terms" className="text-brand/50 hover:text-brand-light underline">Terms</a>{" "}
            and{" "}
            <a href="/legal/privacy" className="text-brand/50 hover:text-brand-light underline">Privacy Policy</a>.
          </p>
        </motion.div>
      </div>
    );
  }

  /* ─── MAIN CATALOGUE ─── */
  return (
    <div className="flex min-h-screen bg-[#0f0f0f]">
      {/* Sidebar — desktop only */}
      <ExploreSidebar />

      {/* Main scrollable content */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <ExploreCatalogue />
      </main>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}
