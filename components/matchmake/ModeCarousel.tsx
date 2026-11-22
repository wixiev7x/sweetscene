"use client";

import { useEffect, useRef, useState } from "react";
import { loadHomeFeed } from "@/lib/actions/home-feed";

export type ModeCard = { key: string; name: string; promise: string; icon: string };

const COPY: Record<string, { eyebrow: string; line: string; cta: string; tint: string }> = {
  quick: { eyebrow: "Quick match", line: "Someone is ready right now.", cta: "Find them", tint: "rgba(225,36,92,.65)" },
  kink: { eyebrow: "By vibe", line: "Tell us what you crave. They want it too.", cta: "Choose your vibe", tint: "rgba(176,92,255,.55)" },
  blind_date: { eyebrow: "Blind date", line: "No names. No faces. Only tension.", cta: "Step into the dark", tint: "rgba(122,31,61,.8)" },
  invite: { eyebrow: "Invite room", line: "Bring someone you already want.", cta: "Open your room", tint: "rgba(217,179,122,.5)" },
};

/** One big mood card at a time; swipe, arrows, dots, keyboard. */
export default function ModeCarousel({ modes, onPick, disabledKey }: { modes: ModeCard[]; onPick: (key: string) => void; disabledKey?: string | null }) {
  const [i, setI] = useState(0);
  const [faces, setFaces] = useState<string[]>([]);
  const touch = useRef<number | null>(null);
  const n = modes.length;
  const go = (d: number) => setI((v) => (v + d + n) % n);

  useEffect(() => {
    loadHomeFeed({ sort: "featured" })
      .then((r) => setFaces(r.map((c) => c.avatar_url).filter((u): u is string => !!u)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="relative">
      <div
        className="relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] bg-[#0b0b0d] sm:aspect-[16/10]"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        {modes.map((m, k) => {
          const c = COPY[m.key] ?? { eyebrow: m.name, line: m.promise, cta: "Enter", tint: "rgba(225,36,92,.6)" };
          const face = faces.length ? faces[k % faces.length] : null;
          const active = k === i;
          return (
            <div
              key={m.key}
              aria-hidden={!active}
              className="absolute inset-0 transition-all duration-700 ease-out"
              style={{ opacity: active ? 1 : 0, transform: active ? "scale(1)" : "scale(1.04)", pointerEvents: active ? "auto" : "none" }}
            >
              {face && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={face}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  style={{ filter: m.key === "blind_date" ? "blur(22px) brightness(.55)" : "blur(10px) brightness(.6) saturate(1.1)", transform: "scale(1.15)" }}
                />
              )}
              <div className="absolute inset-0" style={{ background: `radial-gradient(90% 70% at 30% 100%, ${c.tint}, transparent 70%)` }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />

              {/* Silhouette hint */}
              <svg aria-hidden="true" viewBox="0 0 200 240" className="absolute right-[8%] top-[10%] h-[55%] opacity-25" fill="#000">
                <path d="M100 20c26 0 44 20 44 46s-18 50-44 50-44-24-44-50 18-46 44-46zM30 240c0-52 30-100 70-100s70 48 70 100z" />
              </svg>

              <div className="absolute inset-x-0 bottom-0 p-7 sm:p-10">
                <span className="flex items-center gap-2 text-sm uppercase tracking-[0.25em] text-white/75">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={m.icon} /></svg>
                  {c.eyebrow}
                </span>
                <p className="mt-3 max-w-lg font-display text-[clamp(1.8rem,4.5vw,3rem)] leading-[1.08] text-white">{c.line}</p>
                <button
                  type="button"
                  onClick={() => onPick(m.key)}
                  disabled={disabledKey === m.key}
                  className="mt-6 h-14 rounded-full bg-white px-9 text-[17px] text-black transition-transform active:scale-[0.97] disabled:opacity-60"
                >
                  {c.cta}
                </button>
              </div>
            </div>
          );
        })}

        <div className="absolute right-5 top-5 flex gap-2">
          <button type="button" onClick={() => go(-1)} aria-label="Previous mode" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next mode" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      {/* Mode tabs under the card */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {modes.map((m, k) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setI(k)}
            aria-current={k === i}
            className={`relative pb-2 text-center text-[13px] transition-colors sm:text-[15px] ${k === i ? "text-foreground" : "text-muted hover:text-foreground-dim"}`}
          >
            {m.name}
            <span className={`absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-brand transition-opacity ${k === i ? "opacity-100" : "opacity-0"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
