import type { CSSProperties, ReactNode } from "react";
import { parseInline, type HoverCard, type HoverTheme } from "@/lib/hover-card/schema";

const BG: Record<HoverTheme["bg"], string> = {
  glass: "linear-gradient(160deg, rgba(30,30,34,.92), rgba(14,14,16,.96))",
  solid: "#0e0e10",
  ember: "radial-gradient(120% 90% at 0% 100%, rgba(225,36,92,.45), rgba(40,8,18,.95) 55%, #0b0b0d)",
  velvet: "radial-gradient(120% 90% at 100% 0%, rgba(122,31,61,.6), rgba(18,6,12,.96) 60%, #08080a)",
  midnight: "radial-gradient(120% 90% at 50% 0%, rgba(80,60,160,.35), rgba(10,8,22,.96) 60%, #060608)",
};
const FONT: Record<HoverTheme["font"], string> = {
  round: "var(--font-ui), system-ui, sans-serif",
  mono: "ui-monospace, 'JetBrains Mono', Menlo, monospace",
  serif: "Georgia, 'Times New Roman', serif",
};

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, li, arr) => (
        <span key={li}>
          {parseInline(line).map((s, k) => (
            <span
              key={k}
              style={{
                fontWeight: s.b ? 700 : undefined,
                fontStyle: s.i ? "italic" : undefined,
                textDecoration: [s.u && "underline", s.s && "line-through"].filter(Boolean).join(" ") || undefined,
                color: s.color,
              }}
            >
              {s.text}
            </span>
          ))}
          {li < arr.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

const DIV: Record<string, ReactNode> = {
  line: null,
  dots: "• • •",
  sparkles: "✦ ✧ ✦",
  hearts: "♥ ♡ ♥",
};

/** Renders a validated hover card. Pure; no HTML injection paths. */
export default function HoverCardView({ card, compact = false }: { card: HoverCard; compact?: boolean }) {
  const { theme } = card;
  const shell: CSSProperties = {
    background: BG[theme.bg],
    fontFamily: FONT[theme.font],
    boxShadow:
      theme.border === "glow"
        ? `0 0 0 1px ${theme.accent}55, 0 20px 60px -20px ${theme.accent}88`
        : theme.border === "neon"
          ? `inset 0 0 0 2px ${theme.accent}, 0 0 24px -6px ${theme.accent}`
          : "0 0 0 1px rgba(255,255,255,.06)",
  };
  return (
    <div className={`rounded-[1.5rem] text-foreground-dim ${compact ? "p-5" : "p-6"}`} style={shell}>
      <div className={theme.border === "neon" ? "border-l-2 pl-4" : ""} style={theme.border === "neon" ? { borderColor: `${theme.accent}99` } : undefined}>
        {card.blocks.map((b, k) => {
          const gap = k === 0 ? "" : "mt-4";
          switch (b.type) {
            case "heading":
              return (
                <p
                  key={k}
                  className={`${gap} leading-tight ${b.size === "lg" ? "text-[26px]" : b.size === "sm" ? "text-base" : "text-xl"}`}
                  style={{ color: b.color ?? theme.accent }}
                >
                  <Inline text={b.text} />
                </p>
              );
            case "text":
              return (
                <p key={k} className={`${gap} text-[15px] leading-relaxed`}>
                  <Inline text={b.text} />
                </p>
              );
            case "quote":
              return (
                <blockquote key={k} className={`${gap} border-l-2 pl-4 text-[16px] italic leading-relaxed text-foreground`} style={{ borderColor: theme.accent }}>
                  <Inline text={b.text} />
                </blockquote>
              );
            case "divider":
              return b.style === "line" ? (
                <hr key={k} className={`${gap} border-0`} style={{ height: 1, background: `linear-gradient(90deg, ${theme.accent}, transparent)` }} />
              ) : (
                <p key={k} className={`${gap} text-center tracking-[0.5em]`} style={{ color: theme.accent }} aria-hidden="true">
                  {DIV[b.style]}
                </p>
              );
            case "list":
              return (
                <ul key={k} className={`${gap} space-y-1.5 text-[15px]`}>
                  {b.items.map((it, j) => (
                    <li key={j} className="flex gap-2.5">
                      <span style={{ color: theme.accent }} aria-hidden="true">{b.bullet}</span>
                      <span><Inline text={it} /></span>
                    </li>
                  ))}
                </ul>
              );
            case "tags":
              return (
                <div key={k} className={`${gap} flex flex-wrap gap-1.5`}>
                  {b.items.map((t) => (
                    <span key={t} className="rounded-full px-2.5 py-1 text-xs" style={{ background: `${theme.accent}22`, color: theme.accent }}>
                      {t}
                    </span>
                  ))}
                </div>
              );
            case "stat":
              return (
                <div key={k} className={`${gap} flex items-baseline gap-3 text-[15px]`}>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted">{b.label}</span>
                  <span className="text-foreground">{b.value}</span>
                </div>
              );
            case "image":
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={k} src={b.url} alt="" loading="lazy" className={`${gap} w-full rounded-2xl object-cover`} />
              );
            case "link":
              return (
                <a key={k} href={b.url} target="_blank" rel="noopener noreferrer nofollow ugc" className={`${gap} inline-flex items-center gap-1.5 text-[15px] underline underline-offset-4`} style={{ color: theme.accent }}>
                  {b.label} <span aria-hidden="true">↗</span>
                </a>
              );
          }
        })}
      </div>
    </div>
  );
}
