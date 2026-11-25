"use client";

import { useEffect, useRef, useState } from "react";

export type Pace = "slowburn" | "heated" | "breathless";
export const PACES: { key: Pace; label: string; cps: number }[] = [
  { key: "slowburn", label: "Slow burn", cps: 28 },
  { key: "heated", label: "Heated", cps: 60 },
  { key: "breathless", label: "Breathless", cps: 140 },
];
const KEY = "ss-pace";

export function readPace(): Pace {
  try {
    const v = localStorage.getItem(KEY);
    return v === "slowburn" || v === "breathless" ? v : "heated";
  } catch {
    return "heated";
  }
}

export function usePace(): [Pace, (p: Pace) => void] {
  const [pace, setPace] = useState<Pace>("heated");
  useEffect(() => {
    const sync = () => setPace(readPace());
    sync();
    window.addEventListener("ss-pace", sync);
    return () => window.removeEventListener("ss-pace", sync);
  }, []);
  return [
    pace,
    (p) => {
      try {
        localStorage.setItem(KEY, p);
        window.dispatchEvent(new Event("ss-pace"));
      } catch {}
      setPace(p);
    },
  ];
}

/* Messages already revealed this session never re-animate. */
const done = new Set<string>();

/** Types a message out at the reader's chosen pace. Click to finish instantly. */
export default function Reveal({ id, text, animate, createdAt, onTick }: { id: string; text: string; animate: boolean; createdAt?: string; onTick?: () => void }) {
  const [pace] = usePace();
  /* Only messages that just arrived type out; history renders instantly. */
  const [fresh] = useState(() => !createdAt || Date.now() - new Date(createdAt).getTime() < 15000);
  const skip = !animate || !fresh || done.has(id);
  const [n, setN] = useState(skip ? text.length : 0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (skip) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      done.add(id);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setN(text.length);
      return;
    }
    const cps = PACES.find((p) => p.key === pace)?.cps ?? 60;
    const start = performance.now();
    const step = (t: number) => {
      const next = Math.min(text.length, Math.floor(((t - start) / 1000) * cps));
      setN(next);
      onTick?.();
      if (next < text.length) raf.current = requestAnimationFrame(step);
      else done.add(id);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [id, text, pace, skip, onTick]);

  const typing = n < text.length;
  return (
    <span
      onClick={() => {
        if (!typing) return;
        if (raf.current) cancelAnimationFrame(raf.current);
        done.add(id);
        setN(text.length);
      }}
      className={typing ? "cursor-pointer" : undefined}
    >
      {text.slice(0, n)}
      {typing && <span aria-hidden="true" className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-brand-light" />}
    </span>
  );
}

/** Pace picker shown in the chat header. */
export function PacePicker() {
  const [pace, setPace] = usePace();
  return (
    <div role="radiogroup" aria-label="Reply speed" className="flex rounded-full bg-white/[.06] p-0.5 text-[12px]">
      {PACES.map((p) => (
        <button
          key={p.key}
          type="button"
          role="radio"
          aria-checked={pace === p.key}
          onClick={() => setPace(p.key)}
          className={`h-7 rounded-full px-3 transition-colors ${pace === p.key ? "bg-brand text-white" : "text-muted-strong hover:text-foreground"}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
