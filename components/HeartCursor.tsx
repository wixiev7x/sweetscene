"use client";

import { useEffect, useRef } from "react";

/**
 * HeartCursor — crisp heart silhouette that tracks the pointer instantly.
 *
 * - Fine-pointer devices only; coarse/touch and reduced-motion users get
 *   the native cursor (state is reactive to mid-session preference changes).
 * - pointer-events: none — never blocks clicks.
 * - Direct style mutation on pointermove (no React state, no interpolation).
 * - States: default → hot (links/controls) → primary (data-cursor="primary")
 *   → destructive (data-cursor="destructive") → text (native caret over
 *   text-entry regions). Pressed compresses briefly.
 */

const HOT_SELECTOR =
  "a, button, [role='button'], label, select, summary, input[type='checkbox'], input[type='radio']";
const TEXT_SELECTOR =
  "input:not([type='checkbox']):not([type='radio']):not([type='button']):not([type='submit']):not([type='reset']), textarea, [contenteditable='true']";

export default function HeartCursor() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const el = root;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      document.body.classList.add("heart-cursor-on");

      const setState = (state: string) => {
        if (el.dataset.state !== state) el.dataset.state = state;
      };

      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        el.dataset.visible = "1";
      };
      const onOver = (e: MouseEvent) => {
        const t = e.target as HTMLElement | null;
        if (!t) return;
        if (t.closest('[data-cursor="destructive"]')) {
          setState("destructive");
        } else if (t.closest('[data-cursor="primary"]')) {
          setState("primary");
        } else if (t.closest(TEXT_SELECTOR)) {
          setState("text");
        } else if (t.closest(HOT_SELECTOR)) {
          setState("hot");
        } else {
          setState("default");
        }
      };
      const onDown = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        el.dataset.pressed = "1";
      };
      const onUp = () => {
        delete el.dataset.pressed;
      };
      const onLeave = () => {
        delete el.dataset.visible;
      };
      const onEnter = () => {
        el.dataset.visible = "1";
      };
      const onBlur = () => {
        delete el.dataset.visible;
      };

      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("mouseover", onOver, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointerup", onUp, { passive: true });
      window.addEventListener("pointercancel", onUp, { passive: true });
      document.addEventListener("mouseleave", onLeave);
      document.addEventListener("mouseenter", onEnter);
      window.addEventListener("blur", onBlur);

      cleanup = () => {
        document.body.classList.remove("heart-cursor-on");
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("mouseover", onOver);
        window.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        document.removeEventListener("mouseleave", onLeave);
        document.removeEventListener("mouseenter", onEnter);
        window.removeEventListener("blur", onBlur);
      };
    };

    function sync() {
      const active = finePointer.matches && !reducedMotion.matches;
      if (active && !cleanup) attach();
      else if (!active && cleanup) {
        cleanup();
        cleanup = null;
      }
    }

    sync();
    finePointer.addEventListener("change", sync);
    reducedMotion.addEventListener("change", sync);

    return () => {
      finePointer.removeEventListener("change", sync);
      reducedMotion.removeEventListener("change", sync);
      cleanup?.();
    };
  }, []);

  return (
    <div ref={rootRef} className="heart-cursor" aria-hidden="true">
      <div className="heart-cursor-inner">
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
