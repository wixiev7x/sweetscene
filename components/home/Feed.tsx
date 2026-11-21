"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { loadHomeFeed } from "@/lib/actions/home-feed";
import type { FeedCharacter } from "@/lib/home/feed";

const TABS = [
  { key: "women", label: "Women" },
  { key: "men", label: "Men" },
  { key: "anime", label: "Anime" },
] as const;
const SORTS = [
  { key: "popular", label: "Popular" },
  { key: "new", label: "New" },
  { key: "featured", label: "Featured" },
] as const;
const MOODS = ["Romance", "Fantasy", "Dark", "Drama", "Slice of life", "Adventure"];

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}
function isNew(iso: string) {
  return Date.now() - new Date(iso).getTime() < 7 * 864e5;
}
function hue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 40;
}

function Portrait({ c, sizes }: { c: FeedCharacter; sizes?: string }) {
  if (c.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={c.avatar_url}
        alt=""
        sizes={sizes}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: `radial-gradient(120% 90% at 30% 15%, hsl(${340 + hue(c.name)} 70% 32%), #0B0709 75%)` }}
    >
      <span className="font-display text-4xl text-white/60">{c.name.charAt(0)}</span>
    </div>
  );
}

function Card({ c, onOpen }: { c: FeedCharacter; onOpen: (c: FeedCharacter) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(c)}
      className="group relative block aspect-[5/8] w-full overflow-hidden rounded-xl bg-surface text-left ring-1 ring-line transition-[transform,box-shadow] duration-300 hover:ring-line-strong active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      aria-label={`Open ${c.name}`}
    >
      <Portrait c={c} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0709] via-[#0B0709]/35 to-transparent" />
      <div className="absolute left-1.5 right-1.5 top-1.5 flex items-start justify-between">
        {c.is_featured ? (
          <span className="rounded-full bg-[#0B0709]/70 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-accent-candle backdrop-blur">
            Featured
          </span>
        ) : isNew(c.created_at) ? (
          <span className="rounded-full bg-brand px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-white">New</span>
        ) : (
          <span />
        )}
        {c.is_nsfw && (
          <span className="rounded-full bg-[#0B0709]/70 px-1.5 py-0.5 text-[8.5px] font-bold text-brand-light backdrop-blur">18+</span>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-2 sm:p-2.5">
        <div className="flex items-end justify-between gap-2">
          <p className="truncate font-display text-[12.5px] font-bold leading-tight text-white sm:text-[14px]">{c.name}</p>
          {c.chat_count > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-[9.5px] text-white/70">
              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              {compact(c.chat_count)}
            </span>
          )}
        </div>
        {c.tagline && <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/70 sm:text-[11.5px]">{c.tagline}</p>}
      </div>
    </button>
  );
}

/** The one place the homepage mentions matchmaking — inline, not a hero. */
function MatchTile() {
  return (
    <Link
      href="/matchmake"
      className="group relative col-span-full flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-r from-brand/25 via-surface to-surface px-4 py-3.5 sm:p-5"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-light">Someone&rsquo;s waiting</p>
        <p className="mt-1 font-display text-[15px] font-bold leading-snug text-foreground sm:text-xl">
          Two strangers. One scene. No names.
        </p>
        <p className="mt-1 hidden text-[13px] text-muted-strong sm:block">Match with a real person — reveal only if you both want to.</p>
      </div>
      <span className="ss-pulse flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-white transition-transform group-active:scale-95 sm:h-11 sm:px-5">
        Match
        <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

function PlanTile() {
  return (
    <Link
      href="/store"
      className="col-span-full flex items-center justify-between gap-3 rounded-2xl border border-accent-candle/25 bg-gradient-to-r from-accent-candle/10 to-surface px-4 py-3.5 sm:p-5"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-candle">Up to 75% cheaper</p>
        <p className="mt-1 font-display text-[15px] font-bold text-foreground sm:text-lg">Longer scenes from $1.99/month</p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-accent-candle">See plans →</span>
    </Link>
  );
}

function CreateTile() {
  return (
    <Link
      href="/create-character"
      className="flex aspect-[5/8] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong p-4 text-center transition-colors hover:border-brand/60"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/15 text-2xl text-brand-light">+</span>
      <span className="font-display text-[13px] font-bold">Create yours</span>
    </Link>
  );
}

function QuickView({ c, onClose }: { c: FeedCharacter; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={c.name}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-line-strong bg-surface sm:rounded-3xl" style={{ animation: "iosSheetUp .35s var(--ios-ease) both" }}>
        <div className="group relative aspect-[4/5] w-full">
          <Portrait c={c} sizes="448px" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
            ✕
          </button>
          <div className="absolute inset-x-0 bottom-0 p-5">
            <h2 className="font-display text-3xl font-bold text-white">{c.name}</h2>
            {c.tagline && <p className="mt-1.5 text-[15px] leading-snug text-white/85">{c.tagline}</p>}
          </div>
        </div>
        <div className="space-y-4 p-5 pt-2">
          {c.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {c.tags.slice(0, 5).map((t) => (
                <span key={t} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted-strong">{t}</span>
              ))}
            </div>
          )}
          {c.first_message && (
            <p className="line-clamp-4 rounded-2xl bg-surface-sunken/70 p-4 text-[14px] italic leading-relaxed text-foreground-dim">
              &ldquo;{c.first_message}&rdquo;
            </p>
          )}
          <Link
            href={`/play/${c.id}`}
            className="flex h-12 w-full items-center justify-center rounded-full bg-brand text-[15px] font-semibold text-white transition-transform active:scale-[0.98]"
          >
            Start scene
          </Link>
          {c.chat_count > 0 && <p className="text-center text-xs text-muted">{compact(c.chat_count)} scenes played</p>}
        </div>
      </div>
    </div>
  );
}

export default function Feed({
  initial,
  audience,
  sort,
  mood,
}: {
  initial: FeedCharacter[];
  audience: string;
  sort: string;
  mood: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [done, setDone] = useState(initial.length < 24);
  const [open, setOpen] = useState<FeedCharacter | null>(null);
  const [pending, startTransition] = useTransition();
  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const go = (next: { a?: string; s?: string; m?: string | null }) => {
    const p = new URLSearchParams();
    const a = next.a ?? audience;
    const s = next.s ?? sort;
    const m = next.m === undefined ? mood : next.m;
    if (a !== "women") p.set("a", a);
    if (s !== "popular") p.set("s", s);
    if (m) p.set("m", m);
    startTransition(() => router.replace(p.size ? `/?${p}` : "/", { scroll: false }));
  };

  const more = useCallback(async () => {
    if (loading.current || done) return;
    loading.current = true;
    const next = await loadHomeFeed({ audience, sort, mood, offset: items.length });
    setItems((prev) => [...prev, ...next.filter((n) => !prev.some((p) => p.id === n.id))]);
    if (next.length < 24) setDone(true);
    loading.current = false;
  }, [audience, sort, mood, items.length, done]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && more(), { rootMargin: "600px" });
    io.observe(node);
    return () => io.disconnect();
  }, [more]);

  const cells: React.ReactNode[] = [];
  items.forEach((c, i) => {
    cells.push(<Card key={c.id} c={c} onOpen={setOpen} />);
    if (i === 5) cells.push(<MatchTile key="match" />);
    if (i === 23) cells.push(<PlanTile key="plan" />);
  });
  if (items.length < 6) cells.push(<MatchTile key="match" />);
  if (done) cells.push(<CreateTile key="create" />);

  return (
    <>
      {/* Tabs + sort */}
      <div className="sticky top-14 z-30 -mx-4 bg-background/90 px-4 pt-2 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3 border-b border-line">
          <div className="flex gap-5" role="tablist" aria-label="Browse">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={audience === t.key}
                onClick={() => go({ a: t.key, m: null })}
                className={`relative pb-3 pt-1 font-display text-[17px] font-bold transition-colors ${
                  audience === t.key ? "text-foreground" : "text-muted hover:text-foreground-dim"
                }`}
              >
                {t.label}
                {audience === t.key && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-brand" />}
              </button>
            ))}
          </div>
          <label className="relative mb-2">
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => go({ s: e.target.value })}
              className="h-8 appearance-none rounded-full border border-line bg-surface pl-3 pr-7 text-[13px] font-medium text-foreground-dim focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </label>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none sm:-mx-6 sm:px-6">
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mood === m}
              onClick={() => go({ m: mood === m ? null : m })}
              className={`h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors ${
                mood === m ? "bg-foreground text-background" : "bg-surface text-muted-strong hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className={`mt-1 grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5 transition-opacity sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:gap-2.5 2xl:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] ${pending ? "opacity-50" : ""}`}>
        {cells}
      </div>
      {items.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">Nothing here yet — be the first to create one.</p>
      )}
      <div ref={sentinel} aria-hidden="true" className="h-8" />
      {open && <QuickView c={open} onClose={() => setOpen(null)} />}
    </>
  );
}
