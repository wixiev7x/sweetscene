"use client";

import { useState } from "react";
import type { FeedCharacter } from "@/lib/home/feed";

export function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}
export function isNew(iso: string) {
  return Date.now() - new Date(iso).getTime() < 7 * 864e5;
}
export function hue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 40;
}

export function Portrait({ c, sizes }: { c: FeedCharacter; sizes?: string }) {
  if (c.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={c.avatar_url}
        alt=""
        sizes={sizes}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: `radial-gradient(120% 90% at 30% 15%, hsl(${340 + hue(c.name)} 70% 32%), #0B0709 75%)` }}
    >
      <span className="font-display text-7xl text-white/60">{c.name.charAt(0)}</span>
    </div>
  );
}

export const GENDER_ICON: Record<string, string> = {
  women: "M12 14a5 5 0 100-10 5 5 0 000 10zM12 14v7M9 18h6",
  men: "M10 20a5 5 0 100-10 5 5 0 000 10zM14 10l6-6M15 4h5v5",
  anime: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z",
};

export function Stat({ d, n }: { d: string; n: number }) {
  return (
    <span className="flex items-center gap-1">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
      {compact(n)}
    </span>
  );
}
export const HEART = "M12 21s-7-4.6-9.3-8.4C1 9.6 2.4 6 5.7 6c2 0 3.2 1.1 4.3 2.6C11.1 7.1 12.3 6 14.3 6c3.3 0 4.7 3.6 3 6.6C19 16.4 12 21 12 21z";
export const BUBBLE = "M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2-5.4A8.4 8.4 0 1121 11.5z";

export const FLAME = "M12 22c4 0 7-2.8 7-6.8 0-3.6-2.6-5.4-3.4-8.7-.2.9-.9 2.6-2.3 3.2.3-3.1-1.4-6.2-4.2-7.7.4 3-1.7 5.3-2.8 7C5.4 10.3 5 11.7 5 13.3 5 18.4 8 22 12 22z";

export function Flames({ value, size = 16, onPick }: { value: number; size?: number; onPick?: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = onPick && hover ? hover : value;
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role={onPick ? "radiogroup" : "img"}
      aria-label={`${value} out of 5`}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const on = shown >= n - 0.25;
        const icon = (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="transition-all duration-150"
            style={{ transform: onPick && hover >= n ? "scale(1.18) translateY(-1px)" : undefined, filter: on ? "drop-shadow(0 0 6px rgba(255,46,106,.55))" : undefined }}
          >
            <path d={FLAME} fill={on ? "url(#ss-flame)" : "rgba(255,255,255,.14)"} />
          </svg>
        );
        return onPick ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of 5`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onPick(n)}
            className="p-0.5 active:scale-90"
          >
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        );
      })}
      {onPick && <span className="ml-2 w-16 text-xs text-muted" aria-live="polite">{shown ? `${shown} of 5` : "Rate"}</span>}
    </span>
  );
}

export function FlameDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <linearGradient id="ss-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#B5163F" />
          <stop offset="55%" stopColor="#FF2E6A" />
          <stop offset="100%" stopColor="#FFB37A" />
        </linearGradient>
      </defs>
    </svg>
  );
}
