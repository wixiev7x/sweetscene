"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { loadHomeFeed } from "@/lib/actions/home-feed";
import type { FeedCharacter } from "@/lib/home/feed";
import HeroCarousel from "@/components/home/HeroCarousel";
import CharacterSheet from "@/components/character/CharacterSheet";
import CardHoverPreview, { useHoverMode } from "@/components/hover-card/CardHoverPreview";
import { isNew, Portrait, GENDER_ICON, Stat, HEART, BUBBLE } from "@/components/character/bits";

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

function Card({ c, onOpen }: { c: FeedCharacter; onOpen: (c: FeedCharacter) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(c)}
      className="group relative block aspect-[3/4.4] w-full overflow-hidden rounded-[1.25rem] bg-surface text-left transition-transform duration-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      aria-label={`Open ${c.name}`}
    >
      <Portrait c={c} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/45 via-35% to-transparent" />
      <div className="absolute left-3 right-3 top-3 flex items-start justify-between">
        {c.is_featured ? (
          <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] uppercase tracking-wider text-accent-candle backdrop-blur">Featured</span>
        ) : isNew(c.created_at) ? (
          <span className="rounded-full bg-brand px-2.5 py-1 text-[10px] uppercase tracking-wider text-white">New</span>
        ) : (
          <span />
        )}
        {GENDER_ICON[c.audience] && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white/85 backdrop-blur" aria-label={c.audience}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={GENDER_ICON[c.audience]} /></svg>
          </span>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
        <p className="truncate font-display text-lg leading-tight text-white sm:text-[22px]">
          {c.name}
          {c.age ? <span className="ml-2 text-white/60">{c.age}</span> : null}
        </p>
        {(c.short_description || c.tagline) && (
          <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-white/75">{c.short_description || c.tagline}</p>
        )}
        <div className="mt-2.5 flex items-center gap-3 text-xs text-white/70">
          <Stat d={HEART} n={c.like_count} />
          <Stat d={BUBBLE} n={c.chat_count} />
          <span className="ml-auto truncate">@{c.creator}</span>
        </div>
      </div>
    </button>
  );
}

export default function Feed({
  initial,
  audience,
  sort,
  mood,
  hero = [],
}: {
  initial: FeedCharacter[];
  audience: string;
  sort: string;
  mood: string | null;
  hero?: FeedCharacter[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [done, setDone] = useState(initial.length < 24);
  const [open, setOpen] = useState<FeedCharacter | null>(null);
  const [pending, startTransition] = useTransition();
  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef<HTMLDivElement | null>(null);
  const [hoverMode, setHoverMode] = useHoverMode();
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const node = stickRef.current;
    if (!node) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { rootMargin: "-65px 0px 0px 0px" });
    io.observe(node);
    return () => io.disconnect();
  }, []);

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
  items.forEach((c) =>
    cells.push(
      <CardHoverPreview
        key={c.id}
        mode={hoverMode}
        src={{ name: c.name, age: c.age, story: c.short_description || c.tagline, greeting: c.first_message, tags: c.tags, hover_card: c.hover_card }}
      >
        <Card c={c} onOpen={setOpen} />
      </CardHoverPreview>,
    ),
  );

  return (
    <>
      <HeroCarousel
        faces={hero}
        onOpen={(id) => {
          const c = hero.find((h) => h.id === id) ?? items.find((h) => h.id === id);
          if (c) setOpen(c);
        }}
      />
      <div className="h-4" />
      {/* Category bar: plain text, sticks under the header while scrolling */}
      <div ref={stickRef} aria-hidden="true" className="h-px" />
      <div
        className={`sticky top-16 z-30 -mx-4 px-4 pb-1 pt-2 transition-[background,box-shadow] duration-300 sm:-mx-6 sm:px-6 ${
          stuck ? "bg-black/75 shadow-[0_1px_0_rgba(255,255,255,.06)] backdrop-blur-xl" : "bg-transparent"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-7" role="tablist" aria-label="Browse">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={audience === t.key}
                onClick={() => go({ a: t.key, m: null })}
                className={`relative pb-2.5 pt-1 font-display text-[20px] transition-colors ${
                  audience === t.key ? "text-foreground" : "text-muted hover:text-foreground-dim"
                }`}
              >
                {t.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 bottom-0 h-[2px] origin-left rounded-full bg-brand transition-transform duration-300 ${audience === t.key ? "scale-x-100" : "scale-x-0"}`}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => setHoverMode(hoverMode === "off" ? "custom" : "off")}
            aria-pressed={hoverMode !== "off"}
            className="hidden items-center gap-2 text-[15px] text-muted-strong hover:text-foreground lg:flex"
            title="Show a preview when you hover a character"
          >
            <span className={`relative h-5 w-9 rounded-full transition-colors ${hoverMode !== "off" ? "bg-brand" : "bg-white/15"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${hoverMode !== "off" ? "left-[18px]" : "left-0.5"}`} />
            </span>
            Previews
          </button>
          <label className="relative flex items-center gap-1 text-[15px] text-muted-strong">
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => go({ s: e.target.value })}
              className="cursor-pointer appearance-none bg-transparent pr-5 text-right text-foreground-dim focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key} className="bg-surface">{s.label}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-0 h-3.5 w-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </label>
          </div>
        </div>
        <div className="relative -mx-4 sm:-mx-6">
          <div
            className="flex gap-6 overflow-x-auto px-4 pb-2 pt-2.5 scrollbar-none sm:px-6"
            style={{ maskImage: "linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 32px), transparent)" }}
          >
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mood === m}
                onClick={() => go({ m: mood === m ? null : m })}
                className={`relative shrink-0 pb-1.5 text-[16px] transition-colors ${
                  mood === m ? "text-foreground" : "text-muted hover:text-foreground-dim"
                }`}
              >
                {m}
                <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-brand transition-opacity ${mood === m ? "opacity-100" : "opacity-0"}`} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`mt-1 grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5 ${pending ? "opacity-50" : ""}`}>
        {cells}
      </div>
      {items.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted">No characters here yet.</p>
      )}
      <div ref={sentinel} aria-hidden="true" className="h-8" />
      {open && <CharacterSheet c={open} onClose={() => setOpen(null)} onOpen={setOpen} />}
    </>
  );
}
