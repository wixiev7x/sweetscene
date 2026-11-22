"use client";

import { useState } from "react";
import { VIBE_PIE, MAX_VIBES } from "@/lib/matchmaking/vibes";

const C = 150; // centre
const R_OUT = 140;
const R_IN = 52;
const GAP = 3; // degrees between slices

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function slicePath(start: number, end: number) {
  const s = start + GAP / 2;
  const e = end - GAP / 2;
  const [x1, y1] = polar(R_OUT, s);
  const [x2, y2] = polar(R_OUT, e);
  const [x3, y3] = polar(R_IN, e);
  const [x4, y4] = polar(R_IN, s);
  return `M${x1} ${y1} A${R_OUT} ${R_OUT} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${R_IN} ${R_IN} 0 0 0 ${x4} ${y4}Z`;
}

/**
 * A soft donut of 4 moods. Tapping a slice selects that mood and reveals
 * its 4 sub-moods underneath as round chips. Up to MAX_VIBES total.
 */
export default function VibePie({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  const [focus, setFocus] = useState<number>(() => {
    const i = VIBE_PIE.findIndex((v) => selected.includes(v.main) || v.subs.some((s) => selected.includes(s)));
    return i >= 0 ? i : 0;
  });
  const full = selected.length >= MAX_VIBES;
  const active = VIBE_PIE[focus];

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 300" className="w-full max-w-[300px] select-none" role="group" aria-label="Choose your vibes">
        <defs>
          {VIBE_PIE.map((v, i) => (
            <radialGradient key={v.main} id={`vibe-${i}`} cx="50%" cy="50%" r="60%">
              <stop offset="35%" stopColor={v.color} stopOpacity="0.95" />
              <stop offset="100%" stopColor={v.color} stopOpacity="0.55" />
            </radialGradient>
          ))}
        </defs>
        {VIBE_PIE.map((v, i) => {
          const start = i * 90;
          const on = selected.includes(v.main);
          const lit = on || focus === i;
          const [lx, ly] = polar((R_OUT + R_IN) / 2, start + 45);
          return (
            <g
              key={v.main}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={v.main}
              onClick={() => {
                setFocus(i);
                if (on || !full) onToggle(v.main);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFocus(i);
                  if (on || !full) onToggle(v.main);
                }
              }}
              className="cursor-pointer outline-none"
              style={{
                transformOrigin: `${C}px ${C}px`,
                transform: lit ? "scale(1.035)" : "scale(1)",
                transition: "transform .35s cubic-bezier(.32,.72,0,1), opacity .35s",
                opacity: lit ? 1 : 0.45,
              }}
            >
              <path d={slicePath(start, start + 90)} fill={`url(#vibe-${i})`} stroke={on ? "#fff" : "transparent"} strokeWidth="2" strokeLinejoin="round" />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="15" style={{ pointerEvents: "none" }}>
                {v.main}
              </text>
            </g>
          );
        })}
        <circle cx={C} cy={C} r={R_IN - 8} fill="#000" />
        <text x={C} y={C - 6} textAnchor="middle" fill="#fff" fontSize="22">{selected.length}</text>
        <text x={C} y={C + 14} textAnchor="middle" fill="#9C8B8C" fontSize="10">of {MAX_VIBES}</text>
      </svg>

      <div className="mt-5 flex flex-wrap justify-center gap-2" aria-label={`${active.main} moods`}>
        {active.subs.map((s) => {
          const on = selected.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => onToggle(s)}
              className="h-10 rounded-full px-5 text-sm transition-all active:scale-95 disabled:opacity-40"
              style={
                on
                  ? { background: active.color, color: "#fff" }
                  : { background: "var(--surface-raised)", color: "var(--foreground-dim)" }
              }
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
