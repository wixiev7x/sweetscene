"use client";

import { useEffect, useState } from "react";

const LINES = [
  "Finding your next pleasure…",
  "Someone is getting closer…",
  "Hearts are racing…",
  "A stranger is thinking about you…",
  "Lighting the candles…",
  "Almost close enough to touch…",
];

/** Incoming-call style search animation: pulsing heart rings + rotating lines. */
export default function HeartCall({ elapsed, onCancel }: { elapsed: number; onCancel: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % LINES.length), 2800);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="relative flex flex-col items-center overflow-hidden rounded-[2rem] bg-[radial-gradient(80%_60%_at_50%_40%,rgba(225,36,92,.22),transparent)] px-6 py-14">
      <div className="relative flex h-56 w-56 items-center justify-center">
        {[0, 1, 2, 3].map((k) => (
          <span
            key={k}
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-brand/50"
            style={{ animation: `ssCall 3.2s cubic-bezier(.2,.6,.3,1) ${k * 0.8}s infinite` }}
          />
        ))}
        <span aria-hidden="true" className="absolute inset-10 rounded-full bg-brand/15 blur-2xl" />
        <span className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-brand-light via-brand to-brand-deep shadow-[0_0_60px_-10px_var(--brand)]" style={{ animation: "ssBeat 1.4s ease-in-out infinite" }}>
          <svg width="46" height="46" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M12 21s-7-4.6-9.3-8.4C1 9.6 2.4 6 5.7 6c2 0 3.2 1.1 4.3 2.6C11.1 7.1 12.3 6 14.3 6c3.3 0 4.7 3.6 3 6.6C19 16.4 12 21 12 21z" />
          </svg>
        </span>
      </div>

      <p key={i} className="mt-8 font-display text-2xl text-foreground" style={{ animation: "ssRise .6s var(--ios-ease) both" }} aria-live="polite">
        {LINES[i]}
      </p>
      <p className="mt-2 tabular-nums text-sm text-muted">{mm}:{ss}</p>

      <button
        onClick={onCancel}
        className="mt-8 flex h-12 items-center gap-2 rounded-full bg-surface-raised px-6 text-[15px] text-foreground-dim transition-colors hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
        Not tonight
      </button>
    </div>
  );
}
