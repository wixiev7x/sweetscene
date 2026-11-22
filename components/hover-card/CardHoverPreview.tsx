"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import HoverCardView from "./HoverCardView";
import { sanitizeHoverCard, presetCard, type HoverCard } from "@/lib/hover-card/schema";

export type HoverMode = "custom" | "story" | "greeting" | "off";
const KEY = "ss-hover";

export function readHoverMode(): HoverMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "story" || v === "greeting" || v === "off" ? v : "custom";
  } catch {
    return "custom";
  }
}
export function writeHoverMode(m: HoverMode) {
  try {
    localStorage.setItem(KEY, m);
    window.dispatchEvent(new Event("ss-hover"));
  } catch {}
}
export function useHoverMode(): [HoverMode, (m: HoverMode) => void] {
  const [mode, setMode] = useState<HoverMode>("custom");
  useEffect(() => {
    const sync = () => setMode(readHoverMode());
    sync();
    window.addEventListener("ss-hover", sync);
    return () => window.removeEventListener("ss-hover", sync);
  }, []);
  return [mode, (m) => { writeHoverMode(m); setMode(m); }];
}

type Source = {
  name: string;
  age?: number | null;
  story?: string | null;
  greeting?: string | null;
  tags?: string[];
  hover_card?: unknown;
};

export function resolveCard(src: Source, mode: HoverMode): HoverCard | null {
  if (mode === "off") return null;
  if (mode === "custom" && src.hover_card) {
    const r = sanitizeHoverCard(src.hover_card);
    if ("card" in r && r.card.blocks.length) return r.card;
  }
  if (mode === "greeting" && src.greeting) return presetCard("teaser", src);
  return presetCard(mode === "custom" ? "dossier" : "minimal", src);
}

/**
 * Wraps a card. On fine-pointer devices, hovering for 350ms opens the
 * creator's hover card beside it (flipping to whichever side has room).
 */
export default function CardHoverPreview({ src, mode, children }: { src: Source; mode: HoverMode; children: React.ReactNode }) {
  const anchor = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [fine, setFine] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFine(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPos(null), 120);
  }, []);

  const open = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const W = 400;
      const H = Math.min(560, window.innerHeight - 32);
      const right = r.right + 14 + W < window.innerWidth;
      const left = right ? r.right + 14 : Math.max(16, r.left - 14 - W);
      const top = Math.min(Math.max(16, r.top), window.innerHeight - H - 16);
      setPos({ top, left });
    }, 350);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPos(null);
    const onScroll = () => setPos(null);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pos]);

  const card = fine && mode !== "off" ? resolveCard(src, mode) : null;

  return (
    <div ref={anchor} onMouseEnter={card ? open : undefined} onMouseLeave={card ? close : undefined} onFocus={card ? open : undefined} onBlur={card ? close : undefined}>
      {children}
      {pos && card &&
        createPortal(
          <div
            role="tooltip"
            onMouseEnter={() => timer.current && clearTimeout(timer.current)}
            onMouseLeave={close}
            className="fixed z-[55] w-[400px] max-h-[min(560px,calc(100dvh-32px))] overflow-y-auto overscroll-contain rounded-[1.5rem] scrollbar-none"
            style={{ top: pos.top, left: pos.left, animation: "ssRise .22s var(--ios-ease) both" }}
          >
            <HoverCardView card={card} compact />
          </div>,
          document.body,
        )}
    </div>
  );
}
