"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { loadHomeFeed } from "@/lib/actions/home-feed";
import { getCharacterDetails, submitCharacterReview, type CharacterDetails } from "@/lib/actions/character-details";
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




const LIPS = "M2 11.5c2.5-4 5.5-6 7.4-5 .9.5 1.6 1.2 2.6 1.2s1.7-.7 2.6-1.2c1.9-1 4.9 1 7.4 5-2.6 4.6-6.3 7-10 7s-7.4-2.4-10-7zm3.2.3c2.2 1.1 4.5 1.6 6.8 1.6s4.6-.5 6.8-1.6c-2.2.5-4.5.7-6.8.7s-4.6-.2-6.8-.7z";

function Lips({ value, size = 16, onPick }: { value: number; size?: number; onPick?: (n: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5" role={onPick ? "radiogroup" : "img"} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        const body = (
          <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={`lip-${n}-${size}-${Math.round(value * 10)}`}>
                <stop offset={`${fill * 100}%`} stopColor="#FF2E6A" />
                <stop offset={`${fill * 100}%`} stopColor="rgba(255,255,255,.18)" />
              </linearGradient>
            </defs>
            <path d={LIPS} fill={`url(#lip-${n}-${size}-${Math.round(value * 10)})`} />
          </svg>
        );
        return onPick ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n}`} onClick={() => onPick(n)} className="p-0.5 transition-transform active:scale-90">
            {body}
          </button>
        ) : (
          <span key={n}>{body}</span>
        );
      })}
    </span>
  );
}

function QuickView({ c, onClose }: { c: FeedCharacter; onClose: () => void }) {
  const [d, setD] = useState<CharacterDetails | null>(null);
  const [mine, setMine] = useState(0);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

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
      setMsg("Thanks for the love.");
      setNote("");
      setD(await getCharacterDetails(c.id));
    }
  }

  const [allTags, setAllTags] = useState(false);
  const tags = allTags ? c.tags : c.tags.slice(0, 3);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={c.name}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div
        className="relative flex max-h-[92dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-[2rem] border border-line-strong bg-surface shadow-2xl"
        style={{ animation: "iosSheetUp .3s var(--ios-ease) both" }}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        <div className="overflow-y-auto overscroll-contain">
          {/* Portrait on a blurred copy of itself */}
          <div className="relative flex justify-center overflow-hidden px-6 pb-2 pt-6">
            {c.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.avatar_url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
            )}
            <div className="group relative aspect-[4/5] w-full max-w-[300px] overflow-hidden rounded-[1.75rem] shadow-2xl ring-1 ring-white/10">
              <Portrait c={c} sizes="300px" />
            </div>
          </div>

          <div className="px-5 pb-6 sm:px-7">
            <div className="flex flex-col items-center gap-1 pt-3">
              <Lips value={d?.rating ?? 0} size={20} />
              <span className="text-[11px] text-muted">
                {d?.rating ? `${d.rating.toFixed(1)} · ${d.ratingCount} ${d.ratingCount === 1 ? "rating" : "ratings"}` : "No ratings yet"}
              </span>
            </div>

            <h2 className="mt-3 text-center font-display text-3xl text-foreground">{c.name}</h2>
            <div className="mt-2 flex items-center justify-center gap-4 text-sm text-muted-strong">
              <span className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent-candle text-[11px] text-white">
                  {(d?.creator ?? "S").charAt(0).toUpperCase()}
                </span>
                @{d?.creator ?? "…"}
              </span>
              {c.chat_count > 0 && (
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2-5.4A8.4 8.4 0 1121 11.5z" /></svg>
                  {compact(c.chat_count)}
                </span>
              )}
            </div>

            <Link href={`/play/${c.id}`} className="mt-5 flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-foreground text-base text-background transition-transform active:scale-[0.98]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2-5.4A8.4 8.4 0 1121 11.5z" /></svg>
              Chat
            </Link>

            {c.tagline && <p className="mt-5 text-[15px] leading-relaxed text-foreground-dim">{c.tagline}</p>}

            {c.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="rounded-full border border-line-strong px-3.5 py-1.5 text-sm text-foreground-dim">{t}</span>
                ))}
                {!allTags && c.tags.length > 3 && (
                  <button type="button" onClick={() => setAllTags(true)} className="rounded-full border border-line-strong px-3.5 py-1.5 text-sm text-muted hover:text-foreground">
                    +{c.tags.length - 3} more
                  </button>
                )}
              </div>
            )}

            {d?.about && (
              <section className="mt-6">
                <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted">Their story</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-strong">{d.about}</p>
              </section>
            )}

            {c.first_message && (
              <section className="mt-6">
                <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted">How they greet you</h3>
                <p className="mt-2 rounded-3xl rounded-tl-md bg-surface-raised p-4 text-sm italic leading-relaxed text-foreground-dim">{c.first_message}</p>
              </section>
            )}

            <section className="mt-6">
              <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted">What people say</h3>
              {d && d.reviews.length === 0 && <p className="mt-2 text-sm text-muted">No whispers yet. Be the first.</p>}
              <ul className="mt-2 space-y-2.5">
                {d?.reviews.map((r, i) => (
                  <li key={i} className="rounded-3xl bg-surface-raised/60 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-foreground-dim">@{r.name}</span>
                      <Lips value={r.rating} size={12} />
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-strong">{r.comment}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-3 rounded-3xl border border-line p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Your rating</span>
                  <Lips value={mine} size={22} onPick={setMine} />
                </div>
                {mine > 0 && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value.slice(0, 400))}
                      placeholder="Leave a whisper (optional)"
                      className="h-10 min-w-0 flex-1 rounded-full bg-surface-raised px-4 text-sm text-foreground placeholder:text-muted focus:outline-none"
                    />
                    <button type="button" onClick={send} className="h-10 shrink-0 rounded-full bg-brand px-4 text-sm text-white">Post</button>
                  </div>
                )}
                {msg && <p className="mt-2 text-xs text-brand-lighter">{msg}</p>}
              </div>
            </section>
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
  items.forEach((c) => cells.push(<Card key={c.id} c={c} onOpen={setOpen} />));

  return (
    <>
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

      <div className={`mt-1 grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5 transition-opacity sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:gap-2.5 2xl:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] ${pending ? "opacity-50" : ""}`}>
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
