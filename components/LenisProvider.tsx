"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * Wraps the app in a Lenis smooth-scroll instance.
 *
 * Rules:
 * - Smooth-scroll is only enabled on desktops (pointer: fine). On touch
 *   devices the native momentum scroller is better — Lenis on touch
 *   adds weight and can fight the virtual keyboard on iOS.
 * - Respects prefers-reduced-motion by setting `duration: 0` so the
 *   scroll jumps instantly instead of animating.
 * - The RAF loop is cleaned up on unmount so hot-reload doesn't stack
 *   multiple instances.
 * - Nested independently-scrollable elements (ChatBox, MessageList,
 *   modals) must carry `data-lenis-prevent` to stop Lenis hijacking them.
 */
export default function LenisProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const lenisRef = useRef<Lenis | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = !window.matchMedia("(pointer: fine)").matches;

    /* On touch devices or reduced-motion: skip Lenis entirely — native
       scroll is both faster and more accessible. */
    if (isTouch || reducedMotion) return;

    lenisRef.current = new Lenis({
      duration: reducedMotion ? 0 : 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenisRef.current?.raf(time);
      rafRef.current = requestAnimationFrame(raf);
    }

    rafRef.current = requestAnimationFrame(raf);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
