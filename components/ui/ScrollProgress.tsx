"use client";

import { useEffect, useRef } from "react";

/**
 * ScrollProgress — thin, accurate reading-progress bar under the header.
 *
 * progress = scrollTop / (scrollHeight - clientHeight), clamped to [0, 1].
 * Recalculates on resize, orientation change, route navigation (component
 * remounts), dynamic content growth (ResizeObserver) and font loading.
 * Passive listeners + a single rAF-batched write per frame; the bar is
 * drawn with transform: scaleX (GPU-friendly, no layout thrash).
 * Pages with no scrollable overflow sit quietly at 0.
 */

export default function ScrollProgress() {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    let raf = 0;

    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const top = window.scrollY || doc.scrollTop || 0;
      const progress =
        scrollable <= 0 ? (top > 0 ? 1 : 0) : Math.min(1, Math.max(0, top / scrollable));
      bar.style.transform = `scaleX(${progress})`;
    };

    const requestUpdate = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    window.addEventListener("orientationchange", requestUpdate, { passive: true });
    window.addEventListener("load", requestUpdate);

    const observer = new ResizeObserver(requestUpdate);
    observer.observe(document.body);
    if (document.documentElement.scrollHeight > document.body.scrollHeight) {
      observer.observe(document.documentElement);
    }
    document.fonts?.ready.then(requestUpdate).catch(() => {});

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      window.removeEventListener("orientationchange", requestUpdate);
      window.removeEventListener("load", requestUpdate);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed top-14 left-0 right-0 z-40 h-0.5 pointer-events-none bg-transparent"
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-gradient-to-r from-accent-candle to-accent-rose"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
