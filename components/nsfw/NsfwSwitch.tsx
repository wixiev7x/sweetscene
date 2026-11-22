"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getMyProfile, setNsfwOptIn, submitBirthdate } from "@/lib/actions/profile";
import { useAuthModal } from "@/components/auth/AuthModal";
import { SFW_MODE } from "@/lib/utils/sfw";

const WANT_KEY = "ss-want-nsfw";
type Cohort = "adult" | "minor" | null;

/**
 * 18+ switch, visible to everyone (unless the platform is in SFW mode).
 * Turning it on: sign in → confirm age (birthdate if not set yet) → opt in.
 * Minors stay on SFW. Every check is enforced again server-side
 * (set_own_age_cohort / set_nsfw_opt_in), so the UI can't be bypassed.
 */
export default function NsfwSwitch({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const { openAuth } = useAuthModal();
  const [on, setOn] = useState(false);
  const [cohort, setCohort] = useState<Cohort>(null);
  const [gate, setGate] = useState(false);
  const [pending, start] = useTransition();

  const load = useCallback(async () => {
    const r = await getMyProfile();
    if ("profile" in r) {
      const c = r.profile.age_cohort === "adult" ? "adult" : r.profile.age_cohort === "minor" ? "minor" : null;
      setCohort(c);
      setOn(c === "adult" && r.profile.nsfw_opt_in);
      return c;
    }
    return null;
  }, []);

  useEffect(() => {
    if (!signedIn || SFW_MODE) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().then(() => {
      try {
        if (localStorage.getItem(WANT_KEY) === "1") {
          localStorage.removeItem(WANT_KEY);
          setGate(true);
        }
      } catch {}
    });
  }, [signedIn, load]);

  if (SFW_MODE) return null;

  function toggle() {
    if (on) {
      start(async () => {
        await setNsfwOptIn(false);
        setOn(false);
        router.refresh();
      });
      return;
    }
    if (!signedIn) {
      try {
        localStorage.setItem(WANT_KEY, "1");
      } catch {}
      openAuth("signup");
      return;
    }
    setGate(true);
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        disabled={pending}
        title={on ? "Adult content on" : "Show adult content"}
        className="flex h-11 items-center gap-2.5 rounded-full bg-surface pl-4 pr-1.5 text-[15px] text-foreground-dim transition-colors hover:bg-surface-raised"
      >
        <span className={on ? "text-brand-light" : ""}>18+</span>
        <span className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${on ? "bg-brand" : "bg-white/15"}`}>
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${on ? "left-6" : "left-1"}`}
          />
        </span>
      </button>
      {gate && (
        <AgeGate
          cohort={cohort}
          onClose={() => setGate(false)}
          onDone={(adult) => {
            setGate(false);
            setOn(adult);
            if (adult) router.refresh();
          }}
          refresh={load}
        />
      )}
    </>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function AgeGate({
  cohort,
  onClose,
  onDone,
  refresh,
}: {
  cohort: Cohort;
  onClose: () => void;
  onDone: (adult: boolean) => void;
  refresh: () => Promise<Cohort>;
}) {
  const [step, setStep] = useState<"confirm" | "dob" | "denied">(cohort === "minor" ? "denied" : cohort === "adult" ? "confirm" : "dob");
  const [d, setD] = useState("");
  const [m, setM] = useState("");
  const [y, setY] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const year = new Date().getFullYear();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function optIn() {
    start(async () => {
      const r = await setNsfwOptIn(true);
      if ("error" in r) {
        setStep("denied");
        return;
      }
      onDone(true);
    });
  }

  function submitDob() {
    if (!d || !m || !y) return setErr("Please fill in your date of birth.");
    setErr("");
    start(async () => {
      const r = await submitBirthdate(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
      if ("error" in r) {
        if (r.reason === "underage") return setStep("denied");
        if (r.reason === "already_set") {
          const c = await refresh();
          return setStep(c === "adult" ? "confirm" : "denied");
        }
        return setErr(r.error);
      }
      setStep(r.cohort === "adult" ? "confirm" : "denied");
    });
  }

  const sel = "h-14 rounded-2xl bg-white/[.06] px-4 text-[16px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand/60";

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Age confirmation">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-xl" />
      <div className="relative w-full max-w-[440px] rounded-[2rem] bg-[#121214] p-8 text-center ring-1 ring-white/10" style={{ animation: "iosSheetUp .3s var(--ios-ease) both" }}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-xl text-brand-light">18+</span>

        {step === "dob" && (
          <>
            <h2 className="mt-5 font-display text-[26px] text-white">How old are you?</h2>
            <p className="mt-2 text-[15px] text-muted-strong">We ask once. Your date of birth is never shown to anyone.</p>
            <div className="mt-6 grid grid-cols-[1fr_1.3fr_1.2fr] gap-2">
              <select aria-label="Day" value={d} onChange={(e) => setD(e.target.value)} className={sel}>
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}
              </select>
              <select aria-label="Month" value={m} onChange={(e) => setM(e.target.value)} className={sel}>
                <option value="">Month</option>
                {MONTHS.map((mm, i) => <option key={mm} value={String(i + 1)}>{mm}</option>)}
              </select>
              <select aria-label="Year" value={y} onChange={(e) => setY(e.target.value)} className={sel}>
                <option value="">Year</option>
                {Array.from({ length: 90 }, (_, i) => year - 13 - i).map((yy) => <option key={yy} value={String(yy)}>{yy}</option>)}
              </select>
            </div>
            {err && <p className="mt-3 text-sm text-danger">{err}</p>}
            <button type="button" onClick={submitDob} disabled={pending} className="mt-6 h-14 w-full rounded-full bg-brand text-[17px] text-white disabled:opacity-60">
              {pending ? "One moment…" : "Continue"}
            </button>
          </>
        )}

        {step === "confirm" && (
          <>
            <h2 className="mt-5 font-display text-[26px] text-white">Adult content ahead</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-strong">
              You&rsquo;ll see characters and scenes meant for adults. All characters are fictional adults. You can switch back anytime.
            </p>
            <button type="button" onClick={optIn} disabled={pending} className="mt-7 h-14 w-full rounded-full bg-brand text-[17px] text-white disabled:opacity-60">
              {pending ? "One moment…" : "I'm 18+, show me"}
            </button>
            <button type="button" onClick={() => onDone(false)} className="mt-2.5 h-12 w-full rounded-full text-[15px] text-muted-strong hover:text-white">
              Stay safe-for-work
            </button>
          </>
        )}

        {step === "denied" && (
          <>
            <h2 className="mt-5 font-display text-[26px] text-white">Not available</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-strong">
              Adult content is only for members 18 and over. You&rsquo;ll keep seeing safe-for-work characters.
            </p>
            <button type="button" onClick={() => onDone(false)} className="mt-7 h-14 w-full rounded-full bg-white/[.08] text-[17px] text-white">
              Okay
            </button>
          </>
        )}
      </div>
    </div>
  );
}
