"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type HeroFace = { id: string; name: string; avatar_url: string | null; tagline?: string | null; age?: number | null };

type Slide =
  | { kind: "char"; face: HeroFace }
  | { kind: "desire"; face?: HeroFace }
  | { kind: "offer"; face?: HeroFace };

/**
 * Rotating hero. Featured characters, one Desire slide, one offer slide.
 * Crossfades every 6s, pauses on hover, swipeable on touch.
 */
export default function HeroCarousel({ faces, onOpen }: { faces: HeroFace[]; onOpen?: (id: string) => void }) {
  const chars = faces.filter((f) => f.avatar_url).slice(0, 3);
  const slides: Slide[] = [
    ...(chars[0] ? [{ kind: "char", face: chars[0] } as Slide] : []),
    { kind: "desire", face: chars[1] ?? chars[0] },
    ...chars.slice(1).map((face) => ({ kind: "char", face }) as Slide),
    { kind: "offer", face: chars[2] ?? chars[0] },
  ];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const n = slides.length;

  useEffect(() => {
    if (paused || n < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % n), 6000);
    return () => clearInterval(t);
  }, [paused, n]);

  const go = (d: number) => setI((v) => (v + d + n) % n);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      className="relative mt-3 aspect-[4/5] w-full overflow-hidden rounded-[2rem] bg-[#0b0b0d] sm:aspect-[16/9] lg:aspect-[21/8]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      {slides.map((s, k) => {
        const active = k === i;
        const face = s.face;
        return (
          <div
            key={k}
            aria-hidden={!active}
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{ opacity: active ? 1 : 0, pointerEvents: active ? "auto" : "none" }}
          >
            {face?.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={face.avatar_url}
                alt=""
                className={`absolute inset-y-0 right-0 h-full w-full object-cover object-top transition-transform duration-[7000ms] ease-out sm:w-[62%] ${active ? "scale-105" : "scale-100"} ${s.kind === "desire" ? "blur-[3px] brightness-75" : ""}`}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent sm:bg-gradient-to-r sm:from-black sm:via-black/80 sm:to-transparent" />
            {s.kind !== "char" && (
              <div className="absolute inset-0" style={{ background: s.kind === "desire" ? "radial-gradient(70% 90% at 15% 100%, rgba(225,36,92,.45), transparent)" : "radial-gradient(70% 90% at 15% 100%, rgba(217,179,122,.3), transparent)" }} />
            )}

            <div className="absolute inset-x-0 bottom-0 flex flex-col p-6 sm:inset-y-0 sm:max-w-[48%] sm:justify-center sm:p-12">
              {s.kind === "char" && face && (
                <>
                  <span className="mb-3 flex w-fit items-center gap-2 text-sm text-foreground-dim">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#3ddc84]" /> Online now
                  </span>
                  <h2 className="font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.02] text-white">
                    {face.name.split(" ")[0]}
                    {face.age ? <span className="ml-3 text-white/50">{face.age}</span> : null}
                  </h2>
                  {face.tagline && <p className="mt-3 max-w-md text-[17px] leading-snug text-white/80">{face.tagline}</p>}
                  <button
                    type="button"
                    onClick={() => onOpen?.(face.id)}
                    className="mt-6 h-14 w-fit rounded-full bg-brand px-9 text-lg text-white shadow-[0_14px_44px_-14px_var(--brand)] transition-transform active:scale-[0.97]"
                  >
                    Say hi
                  </button>
                </>
              )}
              {s.kind === "desire" && (
                <>
                  <span className="mb-3 text-sm uppercase tracking-[0.25em] text-brand-light">Desire</span>
                  <h2 className="font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.02] text-white">
                    A stranger is<br />waiting for you.
                  </h2>
                  <p className="mt-3 max-w-md text-[17px] text-white/80">No names. No faces. Just tension, until you both choose to reveal.</p>
                  <Link href="/matchmake" className="mt-6 flex h-14 w-fit items-center rounded-full bg-white px-9 text-lg text-black transition-transform active:scale-[0.97]">
                    Find them
                  </Link>
                </>
              )}
              {s.kind === "offer" && (
                <>
                  <span className="mb-3 text-sm uppercase tracking-[0.25em] text-accent-candle">Tonight only feels short</span>
                  <h2 className="font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.02] text-white">
                    Make the night<br />last longer.
                  </h2>
                  <p className="mt-3 max-w-md text-[17px] text-white/80">Longer scenes, deeper stories, priority matches. Best value on yearly.</p>
                  <Link href="/store" className="mt-6 flex h-14 w-fit items-center rounded-full bg-accent-candle px-9 text-lg text-black transition-transform active:scale-[0.97]">
                    See plans
                  </Link>
                </>
              )}
            </div>
          </div>
        );
      })}

      {n > 1 && (
        <>
          <div className="absolute bottom-5 right-5 flex items-center gap-2 sm:bottom-8 sm:right-8">
            <button type="button" onClick={() => go(-1)} aria-label="Previous" className="hidden h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 sm:flex">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next" className="hidden h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 sm:flex">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
          <div className="absolute left-6 top-6 flex gap-1.5 sm:left-12 sm:top-auto sm:bottom-8">
            {slides.map((_, k) => (
              <button
                key={k}
                type="button"
                aria-label={`Slide ${k + 1}`}
                onClick={() => setI(k)}
                className={`h-1.5 rounded-full transition-all duration-500 ${k === i ? "w-8 bg-white" : "w-3 bg-white/35"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
