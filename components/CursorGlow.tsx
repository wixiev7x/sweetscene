"use client";

import { useEffect, useRef } from "react";

export default function CursorGlow() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const trailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = rootRef.current;
    const dot = dotRef.current;
    const trail = trailRef.current;
    if (!root || !dot || !trail) return;

    document.body.classList.add("cursor-glow-on");

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let dx = mx;
    let dy = my;
    let tx = mx;
    let ty = my;
    let scale = 1;
    let targetScale = 1;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      root.style.opacity = "1";
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("a, button")) {
        targetScale = 3.2;
        dot.classList.add("cursor-ring");
      } else {
        targetScale = 1;
        dot.classList.remove("cursor-ring");
      }
    };
    const onLeave = () => {
      root.style.opacity = "0";
    };
    const onEnter = () => {
      root.style.opacity = "1";
    };

    const loop = () => {
      dx += (mx - dx) * 0.4;
      dy += (my - dy) * 0.4;
      tx += (mx - tx) * 0.15;
      ty += (my - ty) * 0.15;
      scale += (targetScale - scale) * 0.2;
      dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
      trail.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      document.body.classList.remove("cursor-glow-on");
    };
  }, []);

  return (
    <div ref={rootRef} className="cursor-glow" aria-hidden="true">
      <div ref={trailRef} className="cursor-trail" />
      <div ref={dotRef} className="cursor-dot">
        <span className="cursor-heart">♥</span>
      </div>
    </div>
  );
}
