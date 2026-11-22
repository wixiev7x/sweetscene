"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { loadHomeFeed } from "@/lib/actions/home-feed";
import { getCharacterDetails, submitCharacterReview, type CharacterDetails } from "@/lib/actions/character-details";
import type { FeedCharacter } from "@/lib/home/feed";
import HeroCarousel from "@/components/home/HeroCarousel";

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
      <span className="font-display text-7xl text-white/60">{c.name.charAt(0)}</span>
    </div>
  );
}

const GENDER_ICON: Record<string, string> = {
  women: "M12 14a5 5 0 100-10 5 5 0 000 10zM12 14v7M9 18h6",
  men: "M10 20a5 5 0 100-10 5 5 0 000 10zM14 10l6-6M15 4h5v5",
  anime: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z",
};

function Stat({ d, n }: { d: string; n: number }) {
  return (
    <span className="flex items-center gap-1">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
      {compact(n)}
    </span>
  );
}
const HEART = "M12 21s-7-4.6-9.3-8.4C1 9.6 2.4 6 5.7 6c2 0 3.2 1.1 4.3 2.6C11.1 7.1 12.3 6 14.3 6c3.3 0 4.7 3.6 3 6.6C19 16.4 12 21 12 21z";
const BUBBLE = "M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2-5.4A8.4 8.4 0 1121 11.5z";

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

const FLAME = "M12 22c4 0 7-2.8 7-6.8 0-3.6-2.6-5.4-3.4-8.7-.2.9-.9 2.6-2.3 3.2.3-3.1-1.4-6.2-4.2-7.7.4 3-1.7 5.3-2.8 7C5.4 10.3 5 11.7 5 13.3 5 18.4 8 22 12 22z";

function Flames({ value, size = 16, onPick }: { value: number; size?: number; onPick?: (n: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5" role={onPick ? "radiogroup" : "img"} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value >= n - 0.25;
        const icon = (
          <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="transition-transform">
            <path d={FLAME} fill={on ? "url(#ss-flame)" : "rgba(255,255,255,.14)"} />
          </svg>
        );
        return onPick ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n}`} onClick={() => onPick(n)} className="p-0.5 hover:scale-110 active:scale-90">
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        );
      })}
    </span>
  );
}

function FlameDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <linearGradient id="ss-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#B5163F" />
          <stop offset="55%" stopColor="#FF2E6A" />
          <stop offset="100%" stopColor="#FFB37A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function QuickView({ c, onClose }: { c: FeedCharacter; onClose: () => void }) {
  const router = useRouter();
  const [d, setD] = useState<CharacterDetails | null>(null);
  const [mine, setMine] = useState(0);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [moreStory, setMoreStory] = useState(false);
  const [allTags, setAllTags] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let live = true;
    getCharacterDetails(c.id).then((r) => {
      if (!live) return;
      setD(r);
      setMine(r?.myRating ?? 0);
    });
    return () => {
      live = false;
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [c.id, onClose]);

  async function send() {
    if (!mine) return;
    const r = await submitCharacterReview(c.id, mine, note);
    if ("error" in r) setMsg(r.error);
    else {
      setMsg("Thank you.");
      setNote("");
      setD(await getCharacterDetails(c.id));
    }
  }

  /* Replying to the greeting opens the real chat with the text prefilled. */
  function openChat(e?: React.FormEvent) {
    e?.preventDefault();
    const q = reply.trim() ? `?draft=${encodeURIComponent(reply.trim().slice(0, 500))}` : "";
    router.push(`/play/${c.id}${q}`);
  }

  const story = d?.about || c.short_description;
  const tags = allTags ? c.tags : c.tags.slice(0, 4);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-6" role="dialog" aria-modal="true" aria-label={c.name}>
      <FlameDefs />
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      <div
        className="relative grid max-h-[94dvh] w-full max-w-[980px] overflow-hidden rounded-[2rem] bg-[#0b0b0d] shadow-2xl ring-1 ring-white/10 md:grid-cols-[minmax(0,420px)_1fr]"
        style={{ animation: "iosSheetUp .3s var(--ios-ease) both" }}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        {/* Portrait column */}
        <div className="group relative h-[46dvh] md:h-auto">
          <Portrait c={c} sizes="420px" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-[#0b0b0d]/40" />
          <div className="absolute inset-x-0 bottom-0 p-5 md:hidden">
            <h2 className="font-display text-3xl text-white">{c.name}{c.age ? <span className="ml-2 text-white/60">{c.age}</span> : null}</h2>
          </div>
        </div>

        {/* Info + chat column */}
        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-5 sm:px-7 sm:pt-7">
            <h2 className="hidden pr-12 font-display text-4xl leading-tight text-foreground md:block">
              {c.name}{c.age ? <span className="ml-3 text-muted">{c.age}</span> : null}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-strong">
              <span className="flex items-center gap-2">
                <Flames value={d?.rating ?? 0} size={16} />
                <span className="text-muted">{d?.rating ? d.rating.toFixed(1) : "New"}</span>
              </span>
              <Stat d={HEART} n={c.like_count} />
              <Stat d={BUBBLE} n={c.chat_count} />
              <span>by <span className="text-foreground-dim">@{d?.creator ?? c.creator}</span></span>
            </div>

            {c.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="rounded-full bg-white/[.06] px-3.5 py-1.5 text-sm text-foreground-dim">{t}</span>
                ))}
                {!allTags && c.tags.length > 4 && (
                  <button type="button" onClick={() => setAllTags(true)} className="rounded-full bg-white/[.06] px-3.5 py-1.5 text-sm text-muted hover:text-foreground">
                    +{c.tags.length - 4}
                  </button>
                )}
              </div>
            )}

            {story && (
              <div className="mt-5">
                <p className={`whitespace-pre-line text-[15px] leading-relaxed text-foreground-dim ${moreStory ? "" : "line-clamp-4"}`}>{story}</p>
                {story.length > 220 && (
                  <button type="button" onClick={() => setMoreStory((v) => !v)} className="mt-1 text-sm text-muted underline underline-offset-4 hover:text-foreground">
                    {moreStory ? "Less" : "More"}
                  </button>
                )}
              </div>
            )}

            {/* Reviews */}
            <div className="mt-7">
              <div className="flex items-center justify-between">
                <h3 className="text-sm text-foreground">What people say</h3>
                <Flames value={mine} size={20} onPick={setMine} />
              </div>
              {mine > 0 && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 400))}
                    placeholder="Say something about them"
                    className="h-10 min-w-0 flex-1 rounded-full bg-white/[.06] px-4 text-sm text-foreground placeholder:text-muted focus:outline-none"
                  />
                  <button type="button" onClick={send} className="h-10 shrink-0 rounded-full bg-brand px-4 text-sm text-white">Post</button>
                </div>
              )}
              {msg && <p className="mt-2 text-xs text-brand-lighter">{msg}</p>}
              {d && d.reviews.length === 0 && <p className="mt-3 text-sm text-muted">Nobody has said anything yet.</p>}
              <ul className="mt-2 divide-y divide-white/[.06]">
                {d?.reviews.map((r, i) => (
                  <li key={i} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-foreground-dim">@{r.name}</span>
                      <Flames value={r.rating} size={12} />
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-strong">{r.comment}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Their first message as a DM; replying opens the chat */}
          <div className="border-t border-white/[.06] bg-black/40 px-5 py-4 sm:px-7">
            {c.first_message && (
              <div className="flex items-end gap-2.5">
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-surface">
                  {c.avatar_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <p className="line-clamp-4 max-w-[85%] rounded-[1.25rem] rounded-bl-md bg-white/[.08] px-4 py-2.5 text-[14px] leading-relaxed text-foreground-dim">
                  {c.first_message}
                </p>
              </div>
            )}
            <form onSubmit={openChat} className="mt-3 flex items-center gap-2 rounded-full bg-white/[.06] p-1.5 pl-5 ring-1 ring-transparent focus-within:ring-brand/50">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={`Reply to ${c.name.split(" ")[0]}…`}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted focus:outline-none"
              />
              <button type="submit" aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform active:scale-90">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4l17.4-7.5c.8-.3.8-1.5 0-1.8L3.4 3.6c-.7-.3-1.4.4-1.2 1.1L4 11l9 1-9 1-1.8 6.3c-.2.7.5 1.4 1.2 1.1z" /></svg>
              </button>
            </form>
          </div>
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
  items.forEach((c) => cells.push(<Card key={c.id} c={c} onOpen={setOpen} />));

  return (
    <>
      <HeroCarousel
        faces={hero}
        onOpen={(id) => {
          const c = hero.find((h) => h.id === id) ?? items.find((h) => h.id === id);
          if (c) setOpen(c);
        }}
      />
      <div className="h-6" />
      {/* Tabs + sort */}
      <div className="sticky top-16 z-30 -mx-4 bg-background/95 px-4 pt-1 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3 border-b border-line">
          <div className="flex gap-5" role="tablist" aria-label="Browse">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={audience === t.key}
                onClick={() => go({ a: t.key, m: null })}
                className={`relative pb-3 pt-1 font-display text-[17px] transition-colors ${
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

      <div className={`mt-1 grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5 ${pending ? "opacity-50" : ""}`}>
        {cells}
      </div>
      {items.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted">No characters here yet.</p>
      )}
      <div ref={sentinel} aria-hidden="true" className="h-8" />
      {open && <QuickView c={open} onClose={() => setOpen(null)} />}
    </>
  );
}
