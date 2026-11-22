/* ════════════════════════════════════════════════════════════════════
 * Creator-designed hover cards.
 *
 * Pure data + validation, shared by client (editor/renderer) and server
 * (save action). Rendering never uses raw HTML: text is parsed by
 * `parseInline` into typed spans that React renders as elements.
 * ════════════════════════════════════════════════════════════════════ */

export const ACCENTS = ["#FF2E6A", "#E1245C", "#B05CFF", "#7A5CFF", "#3DA9FC", "#2DD4BF", "#D9B37A", "#F4ECE8"] as const;
export const BGS = ["glass", "solid", "ember", "velvet", "midnight"] as const;
export const FONTS = ["round", "mono", "serif"] as const;
export const BORDERS = ["none", "glow", "neon"] as const;
export const DIVIDERS = ["line", "dots", "sparkles", "hearts"] as const;
export const SIZES = ["sm", "md", "lg"] as const;

export type HoverTheme = {
  accent: string;
  bg: (typeof BGS)[number];
  font: (typeof FONTS)[number];
  border: (typeof BORDERS)[number];
};

export type HoverBlock =
  | { type: "heading"; text: string; size: (typeof SIZES)[number]; color?: string }
  | { type: "text"; text: string }
  | { type: "divider"; style: (typeof DIVIDERS)[number] }
  | { type: "list"; items: string[]; bullet: string }
  | { type: "quote"; text: string }
  | { type: "tags"; items: string[] }
  | { type: "stat"; label: string; value: string }
  | { type: "image"; url: string }
  | { type: "link"; label: string; url: string };

export type HoverCard = { blocks: HoverBlock[]; theme: HoverTheme };

export const LIMITS = { blocks: 20, totalChars: 4000, field: 600, listItems: 12, tagItems: 12 } as const;

export const DEFAULT_THEME: HoverTheme = { accent: "#FF2E6A", bg: "glass", font: "round", border: "glow" };

const HEX = /^#[0-9a-fA-F]{6}$/;
const SAFE_IMG = /^https:\/\/([a-z0-9-]+\.supabase\.co\/storage\/v1\/|image\.pollinations\.ai\/|images\.unsplash\.com\/)/;
const BULLETS = ["•", "♥", "✦", "➤", "–", "★", "◆", "♡"];

function str(v: unknown, max: number = LIMITS.field): string | null {
  if (typeof v !== "string") return null;
  // Strip control chars; keep newlines.
  const s = v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim();
  return s.length > 0 && s.length <= max ? s : null;
}

function oneOf<T extends readonly string[]>(v: unknown, list: T, fallback: T[number]): T[number] {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : fallback;
}

export function isSafeUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && !url.username && !url.password && u.length <= 500;
  } catch {
    return false;
  }
}

/** Validates and normalises untrusted input. Returns null if unusable. */
export function sanitizeHoverCard(input: unknown): { card: HoverCard } | { error: string } {
  if (!input || typeof input !== "object") return { error: "Invalid card" };
  const raw = input as { blocks?: unknown; theme?: Record<string, unknown> };
  if (!Array.isArray(raw.blocks)) return { error: "Invalid card" };
  if (raw.blocks.length > LIMITS.blocks) return { error: `Up to ${LIMITS.blocks} blocks` };

  const t = raw.theme ?? {};
  const theme: HoverTheme = {
    accent: typeof t.accent === "string" && HEX.test(t.accent) ? t.accent : DEFAULT_THEME.accent,
    bg: oneOf(t.bg, BGS, DEFAULT_THEME.bg),
    font: oneOf(t.font, FONTS, DEFAULT_THEME.font),
    border: oneOf(t.border, BORDERS, DEFAULT_THEME.border),
  };

  const blocks: HoverBlock[] = [];
  let total = 0;
  const count = (s: string) => (total += s.length);

  for (const b of raw.blocks as Record<string, unknown>[]) {
    if (!b || typeof b !== "object") continue;
    switch (b.type) {
      case "heading": {
        const text = str(b.text, 120);
        if (!text) continue;
        count(text);
        const color = typeof b.color === "string" && HEX.test(b.color) ? b.color : undefined;
        blocks.push({ type: "heading", text, size: oneOf(b.size, SIZES, "md"), ...(color ? { color } : {}) });
        break;
      }
      case "text":
      case "quote": {
        const text = str(b.text);
        if (!text) continue;
        count(text);
        blocks.push({ type: b.type, text });
        break;
      }
      case "divider":
        blocks.push({ type: "divider", style: oneOf(b.style, DIVIDERS, "line") });
        break;
      case "list": {
        const items = (Array.isArray(b.items) ? b.items : []).map((i) => str(i, 160)).filter((i): i is string => !!i).slice(0, LIMITS.listItems);
        if (!items.length) continue;
        items.forEach(count);
        const bullet = typeof b.bullet === "string" && BULLETS.includes(b.bullet) ? b.bullet : "•";
        blocks.push({ type: "list", items, bullet });
        break;
      }
      case "tags": {
        const items = (Array.isArray(b.items) ? b.items : []).map((i) => str(i, 30)).filter((i): i is string => !!i).slice(0, LIMITS.tagItems);
        if (!items.length) continue;
        items.forEach(count);
        blocks.push({ type: "tags", items });
        break;
      }
      case "stat": {
        const label = str(b.label, 40);
        const value = str(b.value, 120);
        if (!label || !value) continue;
        count(label + value);
        blocks.push({ type: "stat", label, value });
        break;
      }
      case "image": {
        const url = typeof b.url === "string" ? b.url : "";
        if (!SAFE_IMG.test(url) || /["'()\\\s<>]/.test(url)) continue;
        blocks.push({ type: "image", url });
        break;
      }
      case "link": {
        const label = str(b.label, 60);
        const url = typeof b.url === "string" ? b.url.trim() : "";
        if (!label || !isSafeUrl(url)) continue;
        count(label);
        blocks.push({ type: "link", label, url });
        break;
      }
      default:
        continue;
    }
  }
  if (total > LIMITS.totalChars) return { error: `Keep it under ${LIMITS.totalChars} characters` };
  return { card: { blocks, theme } };
}

/* ── Inline mini-markup ──
 * **bold**  *italic*  __underline__  ~~strike~~  {#ff2e6a}colored{/}
 * Parsed into spans; no HTML is ever produced. */
export type InlineSpan = { text: string; b?: boolean; i?: boolean; u?: boolean; s?: boolean; color?: string };

export function parseInline(src: string): InlineSpan[] {
  const out: InlineSpan[] = [];
  const state = { b: false, i: false, u: false, s: false, color: undefined as string | undefined };
  let buf = "";
  const flush = () => {
    if (!buf) return;
    out.push({
      text: buf,
      ...(state.b ? { b: true } : {}),
      ...(state.i ? { i: true } : {}),
      ...(state.u ? { u: true } : {}),
      ...(state.s ? { s: true } : {}),
      ...(state.color ? { color: state.color } : {}),
    });
    buf = "";
  };
  let k = 0;
  while (k < src.length) {
    const rest = src.slice(k);
    const color = /^\{(#[0-9a-fA-F]{6})\}/.exec(rest);
    if (color) { flush(); state.color = color[1]; k += color[0].length; continue; }
    if (rest.startsWith("{/}")) { flush(); state.color = undefined; k += 3; continue; }
    if (rest.startsWith("**")) { flush(); state.b = !state.b; k += 2; continue; }
    if (rest.startsWith("__")) { flush(); state.u = !state.u; k += 2; continue; }
    if (rest.startsWith("~~")) { flush(); state.s = !state.s; k += 2; continue; }
    if (rest[0] === "*") { flush(); state.i = !state.i; k += 1; continue; }
    buf += rest[0];
    k += 1;
  }
  flush();
  return out;
}

/* ── Presets ── */
export function presetCard(kind: "dossier" | "teaser" | "minimal", c: { name: string; age?: number | null; story?: string | null; greeting?: string | null; tags?: string[] }): HoverCard {
  const first = c.name.split(" ")[0];
  if (kind === "dossier")
    return {
      theme: { accent: "#FF2E6A", bg: "velvet", font: "mono", border: "neon" },
      blocks: [
        { type: "heading", text: `✦ ${first} ✦`, size: "lg" },
        { type: "divider", style: "line" },
        ...(c.age ? [{ type: "stat", label: "Age", value: String(c.age) } as HoverBlock] : []),
        { type: "stat", label: "Mood", value: (c.tags ?? []).slice(0, 2).join(" · ") || "Unpredictable" },
        { type: "divider", style: "dots" },
        { type: "text", text: c.story || `Nobody really knows ${first}. Yet.` },
      ],
    };
  if (kind === "teaser")
    return {
      theme: { accent: "#FF5C87", bg: "ember", font: "serif", border: "glow" },
      blocks: [
        { type: "quote", text: c.greeting || `You came. I wasn't sure you would.` },
        { type: "divider", style: "sparkles" },
        { type: "text", text: `**${first}** is waiting. *Don't keep them long.*` },
      ],
    };
  return {
    theme: DEFAULT_THEME,
    blocks: [{ type: "text", text: c.story || first }, ...((c.tags ?? []).length ? [{ type: "tags", items: (c.tags ?? []).slice(0, 6) } as HoverBlock] : [])],
  };
}
