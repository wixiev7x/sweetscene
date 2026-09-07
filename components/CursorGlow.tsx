"use client";

import { useEffect, useRef } from "react";

export default function CursorGlow() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = rootRef.current;
    const inner = innerRef.current;
    if (!root || !inner) return;

    document.body.classList.add("heart-cursor-on");

    const onMove = (e: MouseEvent) => {
      root.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      root.style.opacity = "1";
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("a, button, [role='button'], label")) {
        inner.classList.add("cursor-hot");
      } else {
        inner.classList.remove("cursor-hot");
      }
    };
    const onLeave = () => {
      root.style.opacity = "0";
    };
    const onEnter = () => {
      root.style.opacity = "1";
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      document.body.classList.remove("heart-cursor-on");
    };
  }, []);

  return (
    <div ref={rootRef} className="heart-cursor" aria-hidden="true">
      <div ref={innerRef} className="heart-cursor-inner">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          shapeRendering="geometricPrecision"
          aria-hidden="true"
        >
          <path
            className="heart-cursor-path"
            d="M12 21s-7-4.6-9.3-8.4C1 9.6 2.4 6 5.7 6c2 0 3.2 1.1 4.3 2.6C11.1 7.1 12.3 6 14.3 6c3.3 0 4.7 3.6 3 6.6C19 16.4 12 21 12 21z"
          />
        </svg>
      </div>
    </div>
  );
}
