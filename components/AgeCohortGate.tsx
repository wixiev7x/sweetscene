"use client";

import { useCallback, useEffect, useState } from "react";
import { getMyProfile, submitBirthdate } from "@/lib/actions/profile";
import { MIN_PLATFORM_AGE, ADULT_AGE } from "@/lib/config/constants";

/**
 * Post-authentication birthdate capture.
 *
 * SECURITY CONTEXT: the pre-auth picker on the landing page is UX only
 * — localStorage is user-controlled and carries no weight. The binding
 * record is created here, by sending the raw birthdate to the
 * authenticated `set_own_age_cohort` RPC, which computes the age in SQL
 * and derives the cohort. Nothing on the client decides adulthood.
 *
 * Accounts with no birthdate on file have a NULL cohort, and every NSFW
 * check fails closed against NULL — so this gate is what makes NSFW
 * reachable for adults, not what protects it from minors.
 *
 * Renders nothing for signed-out users and for accounts that already
 * have a birthdate recorded (the RPC is write-once regardless).
 */
export default function AgeCohortGate() {
  const [needsDob, setNeedsDob] = useState(false);
  const [checked, setChecked] = useState(false);
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const send = useCallback(async (iso: string): Promise<boolean> => {
    const result = await submitBirthdate(iso);
    if ("success" in result) {
      setNeedsDob(false);
      return true;
    }
    /* already_set means another tab/session recorded it — treat as done. */
    if (result.reason === "already_set") {
      setNeedsDob(false);
      return true;
    }
    setError(result.error);
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await getMyProfile();
      if (cancelled) return;

      /* Signed out, or profile unreadable — nothing to gate. */
      if ("error" in result) {
        setChecked(true);
        return;
      }

      if (result.profile.age_cohort !== null) {
        setChecked(true);
        return;
      }

      /* Carry over the DOB entered pre-auth so the user isn't asked
         twice. It is only a claim either way — the server recomputes. */
      const pending = sessionStorage.getItem("sweetscene_pending_dob");
      if (pending && /^\d{4}-\d{2}-\d{2}$/.test(pending)) {
        sessionStorage.removeItem("sweetscene_pending_dob");
        const ok = await send(pending);
        if (cancelled) return;
        if (ok) {
          setChecked(true);
          return;
        }
      }

      setNeedsDob(true);
      setChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [send]);

  if (!checked || !needsDob) return null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const daysInMonth = month
    ? new Date(parseInt(year || String(currentYear), 10), parseInt(month, 10), 0).getDate()
    : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  async function handleSubmit() {
    setError("");
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    const y = parseInt(year, 10);

    if (!m || !d || !y) {
      setError("Please select your full date of birth.");
      return;
    }

    /* Reject impossible dates (e.g. 31 February) before the round-trip. */
    const probe = new Date(y, m - 1, d);
    if (probe.getMonth() !== m - 1 || probe.getDate() !== d) {
      setError("Please enter a valid date of birth.");
      return;
    }

    setSaving(true);
    await send(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[100] bg-void-950/95 backdrop-blur-sm flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <h2 className="text-xl font-light text-white">
          One more thing
        </h2>
        <p className="text-sm text-muted-strong mt-3 leading-relaxed">
          Confirm your date of birth to finish setting up your account.
          You must be {MIN_PLATFORM_AGE} or older to use sweetscene. Adult
          ({ADULT_AGE}+) content stays off unless you turn it on later.
        </p>
        <p className="text-xs text-muted-faint mt-2">
          This is recorded once and can&apos;t be changed here.
        </p>

        <div className="flex items-center justify-center gap-2 mt-6">
          <select
            aria-label="Birth month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
          >
            <option value="">Month</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            aria-label="Birth day"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
          >
            <option value="">Day</option>
            {days.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            aria-label="Birth year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
          >
            <option value="">Year</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-xs text-red-400 mt-4">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="mt-6 px-6 py-2 rounded-lg bg-brand-dark hover:bg-brand disabled:opacity-50 text-white text-sm transition-colors"
        >
          {saving ? "Saving…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
