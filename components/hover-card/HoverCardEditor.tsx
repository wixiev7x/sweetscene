"use client";

import { useState } from "react";
import HoverCardView from "./HoverCardView";
import {
  ACCENTS,
  BGS,
  BORDERS,
  DEFAULT_THEME,
  DIVIDERS,
  FONTS,
  LIMITS,
  SIZES,
  presetCard,
  sanitizeHoverCard,
  type HoverBlock,
  type HoverCard,
} from "@/lib/hover-card/schema";

const BLOCK_TYPES: { type: HoverBlock["type"]; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "quote", label: "Quote" },
  { type: "stat", label: "Detail" },
  { type: "list", label: "List" },
  { type: "tags", label: "Tags" },
  { type: "divider", label: "Divider" },
  { type: "image", label: "Image" },
  { type: "link", label: "Link" },
];

function blank(type: HoverBlock["type"]): HoverBlock {
  switch (type) {
    case "heading": return { type, text: "", size: "md" };
    case "text": return { type, text: "" };
    case "quote": return { type, text: "" };
    case "stat": return { type, label: "", value: "" };
    case "list": return { type, items: [""], bullet: "♥" };
    case "tags": return { type, items: [] };
    case "divider": return { type, style: "sparkles" };
    case "image": return { type, url: "" };
    case "link": return { type, label: "", url: "" };
  }
}

const input = "h-11 w-full rounded-2xl bg-white/[.06] px-4 text-[15px] text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand/60";
const area = "min-h-[90px] w-full rounded-2xl bg-white/[.06] px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand/60";

function Chips<T extends string>({ value, options, onChange, render }: { value: T; options: readonly T[]; onChange: (v: T) => void; render?: (v: T) => React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`h-9 rounded-full px-3.5 text-sm capitalize transition-colors ${value === o ? "bg-foreground text-background" : "bg-white/[.06] text-muted-strong hover:text-foreground"}`}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

/**
 * Block editor for creator hover cards. Controlled: `value` + `onChange`.
 * Shows a live preview using the same renderer as the hover popover.
 */
export default function HoverCardEditor({
  value,
  onChange,
  seed,
  images = [],
}: {
  value: HoverCard | null;
  onChange: (c: HoverCard | null) => void;
  seed: { name: string; age?: number | null; story?: string | null; greeting?: string | null; tags?: string[] };
  images?: string[];
}) {
  const card: HoverCard = value ?? { blocks: [], theme: DEFAULT_THEME };
  const [adding, setAdding] = useState(false);
  const check = sanitizeHoverCard(card);
  const chars = card.blocks.reduce((n, b) => n + JSON.stringify(b).length, 0);

  const set = (blocks: HoverBlock[], theme = card.theme) => onChange({ blocks, theme });
  const update = (k: number, patch: Partial<HoverBlock>) =>
    set(card.blocks.map((b, j) => (j === k ? ({ ...b, ...patch } as HoverBlock) : b)));
  const move = (k: number, d: number) => {
    const j = k + d;
    if (j < 0 || j >= card.blocks.length) return;
    const next = [...card.blocks];
    [next[k], next[j]] = [next[j], next[k]];
    set(next);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm text-muted">Start from a style</p>
          <div className="flex flex-wrap gap-2">
            {(["dossier", "teaser", "minimal"] as const).map((p) => (
              <button key={p} type="button" onClick={() => onChange(presetCard(p, seed))} className="h-10 rounded-full bg-white/[.06] px-4 text-sm capitalize text-foreground-dim hover:bg-white/10">
                {p}
              </button>
            ))}
            {value && (
              <button type="button" onClick={() => onChange(null)} className="h-10 rounded-full px-4 text-sm text-muted hover:text-danger">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Theme */}
        <div className="space-y-3 rounded-[1.5rem] bg-white/[.03] p-5 ring-1 ring-white/[.06]">
          <p className="text-sm text-foreground">Look</p>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a}
                type="button"
                aria-label={`Accent ${a}`}
                onClick={() => set(card.blocks, { ...card.theme, accent: a })}
                className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-[#0b0b0d] transition-transform hover:scale-110 ${card.theme.accent === a ? "ring-2 ring-white" : ""}`}
                style={{ background: a }}
              />
            ))}
            <label className="ml-1 flex h-8 items-center gap-2 rounded-full bg-white/[.06] pl-1 pr-3 text-xs text-muted">
              <input
                type="color"
                value={card.theme.accent}
                onChange={(e) => set(card.blocks, { ...card.theme, accent: e.target.value })}
                className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent"
              />
              Custom
            </label>
          </div>
          <Chips value={card.theme.bg} options={BGS} onChange={(bg) => set(card.blocks, { ...card.theme, bg })} />
          <Chips value={card.theme.font} options={FONTS} onChange={(font) => set(card.blocks, { ...card.theme, font })} />
          <Chips value={card.theme.border} options={BORDERS} onChange={(border) => set(card.blocks, { ...card.theme, border })} />
        </div>

        {/* Blocks */}
        <ol className="space-y-3">
          {card.blocks.map((b, k) => (
            <li key={k} className="rounded-[1.5rem] bg-white/[.03] p-4 ring-1 ring-white/[.06]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.16em] text-muted">{BLOCK_TYPES.find((t) => t.type === b.type)?.label}</span>
                <span className="flex gap-1">
                  <button type="button" onClick={() => move(k, -1)} aria-label="Move up" className="h-8 w-8 rounded-full text-muted hover:bg-white/10 hover:text-foreground">↑</button>
                  <button type="button" onClick={() => move(k, 1)} aria-label="Move down" className="h-8 w-8 rounded-full text-muted hover:bg-white/10 hover:text-foreground">↓</button>
                  <button type="button" onClick={() => set(card.blocks.filter((_, j) => j !== k))} aria-label="Remove" className="h-8 w-8 rounded-full text-muted hover:bg-white/10 hover:text-danger">✕</button>
                </span>
              </div>

              {b.type === "heading" && (
                <div className="space-y-2">
                  <input className={input} value={b.text} maxLength={120} placeholder="✦ Their name ✦" onChange={(e) => update(k, { text: e.target.value })} />
                  <Chips value={b.size} options={SIZES} onChange={(size) => update(k, { size })} />
                </div>
              )}
              {(b.type === "text" || b.type === "quote") && (
                <textarea className={area} value={b.text} maxLength={600} placeholder={b.type === "quote" ? "Something they'd whisper…" : "Their story. **bold**, *italic*, {#ff2e6a}color{/}"} onChange={(e) => update(k, { text: e.target.value })} />
              )}
              {b.type === "stat" && (
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <input className={input} value={b.label} maxLength={40} placeholder="Occupation" onChange={(e) => update(k, { label: e.target.value })} />
                  <input className={input} value={b.value} maxLength={120} placeholder="Art thief" onChange={(e) => update(k, { value: e.target.value })} />
                </div>
              )}
              {b.type === "list" && (
                <div className="space-y-2">
                  <Chips value={b.bullet} options={["♥", "✦", "➤", "•", "★", "◆", "♡", "–"] as const} onChange={(bullet) => update(k, { bullet })} />
                  <textarea className={area} value={b.items.join("\n")} placeholder="One item per line" onChange={(e) => update(k, { items: e.target.value.split("\n").slice(0, LIMITS.listItems) })} />
                </div>
              )}
              {b.type === "tags" && (
                <input className={input} value={b.items.join(", ")} placeholder="Slow burn, Mystery" onChange={(e) => update(k, { items: e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, LIMITS.tagItems) })} />
              )}
              {b.type === "divider" && <Chips value={b.style} options={DIVIDERS} onChange={(style) => update(k, { style })} />}
              {b.type === "image" && (
                images.length ? (
                  <div className="flex gap-2 overflow-x-auto">
                    {images.map((u) => (
                      <button key={u} type="button" onClick={() => update(k, { url: u })} className={`h-20 w-16 shrink-0 overflow-hidden rounded-xl ${b.url === u ? "ring-2 ring-brand" : ""}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">Upload a character image first.</p>
                )
              )}
              {b.type === "link" && (
                <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
                  <input className={input} value={b.label} maxLength={60} placeholder="More of me" onChange={(e) => update(k, { label: e.target.value })} />
                  <input className={input} value={b.url} placeholder="https://" onChange={(e) => update(k, { url: e.target.value })} />
                </div>
              )}
            </li>
          ))}
        </ol>

        {card.blocks.length < LIMITS.blocks && (
          adding ? (
            <div className="flex flex-wrap gap-2">
              {BLOCK_TYPES.map((t) => (
                <button key={t.type} type="button" onClick={() => { set([...card.blocks, blank(t.type)]); setAdding(false); }} className="h-10 rounded-full bg-white/[.06] px-4 text-sm text-foreground-dim hover:bg-white/10">
                  {t.label}
                </button>
              ))}
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="h-12 w-full rounded-full border border-dashed border-white/15 text-[15px] text-muted-strong hover:border-brand/60 hover:text-foreground">
              + Add a block
            </button>
          )
        )}
        <p className="text-xs text-muted">
          {card.blocks.length}/{LIMITS.blocks} blocks · {Math.min(chars, 9999)} chars
          {"error" in check && <span className="ml-2 text-danger">{check.error}</span>}
        </p>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-sm text-muted">Preview, as people see it on hover</p>
        {"card" in check && check.card.blocks.length ? (
          <div className="max-h-[560px] overflow-y-auto rounded-[1.5rem] scrollbar-none">
            <HoverCardView card={check.card} compact />
          </div>
        ) : (
          <div className="flex h-60 items-center justify-center rounded-[1.5rem] bg-white/[.03] text-sm text-muted ring-1 ring-white/[.06]">
            Pick a style or add a block
          </div>
        )}
      </div>
    </div>
  );
}
