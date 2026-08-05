"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a pixelated cupid-heart custom cursor that follows the mouse
 * on desktop (pointer:fine). On touch/mobile the component renders nothing
 * and the default cursor is restored so tapping feels native.
 *
 * The cursor is drawn as an SVG pixel-art heart with a tiny cupid arrow
 * through it, scaled to 32×32 and rendered via CSS `cursor: url(...)`.
 * A trailing dot element adds a subtle lag-follow effect using RAF with
 * linear interpolation — cheap and smooth, no GSAP needed.
 *
 * Performance notes:
 * - Uses `transform` only (no top/left) so the browser can GPU-composite.
 * - The pointer listener is on the window with `{ passive: true }`.
 * - On reduced-motion the trail is disabled (instant snap).
 */

/** Inline SVG pixel-art cupid heart — 16×16 pixel grid, 32px rendered. */
const CURSOR_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 20 20'>
  <!-- heart body -->
  <rect x='2' y='5' width='2' height='2' fill='%23ff6b9d'/>
  <rect x='4' y='3' width='4' height='2' fill='%23ff6b9d'/>
  <rect x='8' y='3' width='4' height='2' fill='%23ff6b9d'/>
  <rect x='12' y='5' width='2' height='2' fill='%23ff6b9d'/>
  <rect x='2' y='7' width='12' height='2' fill='%23ff6b9d'/>
  <rect x='4' y='9' width='10' height='2' fill='%23ff6b9d'/>
  <rect x='6' y='11' width='6' height='2' fill='%23ff6b9d'/>
  <rect x='8' y='13' width='2' height='2' fill='%23ff6b9d'/>
  <!-- highlight pixel -->
  <rect x='4' y='5' width='2' height='2' fill='%23ffaecf'/>
  <!-- arrow shaft -->
  <rect x='0' y='9' width='14' height='1' fill='%23ffd700'/>
  <rect x='0' y='10' width='14' height='1' fill='%23c8a000'/>
  <!-- arrowhead -->
  <rect x='14' y='8' width='2' height='4' fill='%23ffd700'/>
  <rect x='16' y='7' width='2' height='6' fill='%23ffd700'/>
  <!-- arrow tail feathers -->
  <rect x='0' y='7' width='2' height='2' fill='%23ff6b9d'/>
  <rect x='0' y='11' width='2' height='2' fill='%23ff6b9d'/>
</svg>`;

const CURSOR_URL = `url("data:image/svg+xml,${CURSOR_SVG}") 10 10, auto`;

export default function CupidCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const dot = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);
  const [isPointer, setIsPointer] = useState(false);

  useEffect(() => {
    /* Only run on fine-pointer (desktop) devices. */
    const mq = window.matchMedia("(pointer: fine)");
    if (!mq.matches) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* Inject global cursor override */
    const style = document.createElement("style");
    style.id = "cupid-cursor-style";
    style.textContent = `* { cursor: ${CURSOR_URL} !important; }`;
    document.head.appendChild(style);

    function onMouseMove(e: MouseEvent) {
      mouse.current = { x: e.clientX, y: e.clientY };
    }

    function loop() {
      if (!dotRef.current) {
        rafId.current = requestAnimationFrame(loop);
        return;
      }

      if (reduced) {
        dot.current = { ...mouse.current };
      } else {
        /* Lerp the trailing dot toward the real cursor */
        dot.current.x += (mouse.current.x - dot.current.x) * 0.12;
        dot.current.y += (mouse.current.y - dot.current.y) * 0.12;
      }

      dotRef.current.style.transform = `translate(${dot.current.x - 5}px, ${dot.current.y - 5}px)`;
      rafId.current = requestAnimationFrame(loop);
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    rafId.current = requestAnimationFrame(loop);

    /* Track hover over clickable elements for dot colour change */
    function onMouseOver(e: MouseEvent) {
      const target = e.target as HTMLElement;
      setIsPointer(
        target.tagName === "A" ||
          target.tagName === "BUTTON" ||
          target.closest("a") !== null ||
          target.closest("button") !== null
      );
    }

    document.addEventListener("mouseover", onMouseOver, { passive: true });

    return () => {
      document.head.querySelector("#cupid-cursor-style")?.remove();
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseover", onMouseOver);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div
      ref={dotRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: isPointer ? "#ffd700" : "rgba(255,107,157,0.6)",
        pointerEvents: "none",
        zIndex: 99999,
        transition: "background 0.2s",
        mixBlendMode: "screen",
        willChange: "transform",
      }}
    />
  );
}
