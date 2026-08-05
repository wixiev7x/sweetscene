"use client";

import Image from "next/image";

/**
 * Auto-scrolling horizontal marquee strip with character images.
 * Uses CSS animation (`@keyframes marquee`) rather than JS for the
 * scroll — zero runtime cost and plays fine even if the RAF budget is
 * tight. Respects prefers-reduced-motion by pausing the animation.
 *
 * Two duplicate rows run in opposite directions for a layered feel.
 */

const ROW_A = [
  { src: "/images/hero-girl-1.png", label: "Aria" },
  { src: "/images/hero-guy-1.png", label: "Marcus" },
  { src: "/images/hero-girl-2.png", label: "Luna" },
  { src: "/images/grid-girl-1.png", label: "Violet" },
  { src: "/images/grid-girl-2.png", label: "Serena" },
];

const ROW_B = [
  { src: "/images/grid-guy-2.png", label: "Dante" },
  { src: "/images/grid-girl-4.png", label: "Nova" },
  { src: "/images/grid-girl-5.png", label: "Carmen" },
  { src: "/images/grid-girl-6.png", label: "Isabella" },
  { src: "/images/hero-girl-3.png", label: "Mei" },
];

function MarqueeRow({
  items,
  reverse = false,
  speed = 40,
}: {
  items: { src: string; label: string }[];
  reverse?: boolean;
  speed?: number;
}) {
  /* Duplicate items to create the seamless loop */
  const doubled = [...items, ...items, ...items];

  return (
    <div className="overflow-hidden w-full">
      <div
        className="flex gap-3"
        style={{
          animation: `marquee-${reverse ? "reverse" : "forward"} ${speed}s linear infinite`,
          width: "max-content",
        }}
      >
        {doubled.map((item, i) => (
          <div
            key={`${item.src}-${i}`}
            className="relative flex-shrink-0 overflow-hidden rounded-lg"
            style={{ width: 160, height: 220 }}
          >
            <Image
              src={item.src}
              alt={item.label}
              fill
              className="object-cover"
              loading="lazy"
              sizes="160px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <span className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/80 font-light tracking-widest uppercase">
              {item.label}
            </span>
            <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-brand/20 pointer-events-none" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Marquee() {
  return (
    <section
      aria-label="Character showcase"
      className="py-12 overflow-hidden relative"
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black via-transparent to-black" />

      <div className="flex flex-col gap-4">
        <MarqueeRow items={ROW_A} reverse={false} speed={35} />
        <MarqueeRow items={ROW_B} reverse={true} speed={45} />
      </div>

      <style jsx>{`
        @keyframes marquee-forward {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        @keyframes marquee-reverse {
          0% { transform: translateX(-33.333%); }
          100% { transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          div[style*="marquee"] {
            animation-play-state: paused !important;
          }
        }
      `}</style>
    </section>
  );
}
