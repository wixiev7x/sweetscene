"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BATCH_SIZE = 12;

const FILTER_CATEGORIES = ["Hot Picks", "New", "Girlfriend", "Boyfriend", "Anime", "Gaming", "All Tags"];
const NSFW_CATEGORIES = ["NSFW", "Dominant", "Submissive", "Taboo"];

const SORT_MODES = ["Popular", "New", "Top"] as const;
const SORT_SUBS: Record<string, string[]> = {
  Popular: ["This Week", "This Month", "All Time"],
  New: ["Today", "This Week", "This Month"],
  Top: ["All Time", "This Month", "This Week"],
};

type Character = {
  id: string;
  name: string;
  tagline: string | null;
  is_nsfw: boolean;
  genres: string[] | null;
  image_url: string | null;
};

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const ART_PALETTES = [
  { a: "oklch(0.32 0.06 300)", b: "oklch(0.15 0.025 285)", glow: "oklch(0.82 0.14 75)" },
  { a: "oklch(0.34 0.07 330)", b: "oklch(0.15 0.03 290)", glow: "oklch(0.72 0.16 10)" },
  { a: "oklch(0.28 0.05 260)", b: "oklch(0.16 0.03 280)", glow: "oklch(0.82 0.14 75)" },
  { a: "oklch(0.36 0.08 350)", b: "oklch(0.17 0.04 300)", glow: "oklch(0.62 0.22 350)" },
];

function CardArt({ name }: { name: string }) {
  const seed = hashStr(name);
  const p = ART_PALETTES[seed % ART_PALETTES.length];
  const gid = `a${seed % 99991}`;
  const initial = name.charAt(0).toUpperCase();
  const cx = 210 + (seed % 60);
  const cy = 80 + (seed % 50);
  return (
    <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.a} />
          <stop offset="100%" stopColor={p.b} />
        </linearGradient>
        <radialGradient id={`${gid}-glow`} cx={`${cx / 3}`} cy={`${cy / 4}`} r="0.9">
          <stop offset="0%" stopColor={p.glow} stopOpacity="0.4" />
          <stop offset="60%" stopColor={p.glow} stopOpacity="0.08" />
          <stop offset="100%" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${gid}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.95 0.01 60)" stopOpacity="0.14" />
          <stop offset="45%" stopColor="oklch(0.95 0.01 60)" stopOpacity="0" />
          <stop offset="100%" stopColor="oklch(0.12 0.02 285)" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width="300" height="400" fill={`url(#${gid}-bg)`} />
      <rect width="300" height="400" fill={`url(#${gid}-glow)`} />
      <circle cx={cx} cy={cy} r="5" fill={p.glow} opacity="0.9" />
      <circle cx={cx} cy={cy} r="11" fill="none" stroke={p.glow} strokeWidth="1" opacity="0.35" />
      <path d="M 20 340 Q 150 300 280 350" fill="none" stroke="oklch(0.72 0.16 10)" strokeWidth="1.2" opacity="0.3" />
      <text
        x="150"
        y="205"
        textAnchor="middle"
        fontSize="150"
        fontFamily="var(--font-press-start), Fraunces, Georgia, serif"
        fontWeight="600"
        fill="oklch(0.95 0.01 60)"
        opacity="0.22"
      >
        {initial}
      </text>
      <rect width="300" height="400" fill={`url(#${gid}-rim)`} />
    </svg>
  );
}

function CardSkeleton() {
  return (
    <div className="ios-card ios-row min-w-[45%] shrink-0 snap-start overflow-hidden border border-line md:min-w-0">
      <div className="aspect-[3/4] w-full animate-pulse bg-surface-raised" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-surface-raised" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-surface-raised" />
      </div>
    </div>
  );
}

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [filter, setFilter] = useState("All");
  const [nsfwMode, setNsfwMode] = useState(false);
  const [showNsfwConfirm, setShowNsfwConfirm] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortMode, setSortMode] = useState<string>("Popular");
  const [sortSub, setSortSub] = useState<string>("This Week");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("bots")
          .select("id, name, tagline, is_nsfw, genres, image_url")
          .order("created_at", { ascending: false })
          .limit(50);
        if (!cancelled && data) setCharacters(data as Character[]);
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((v) => v + BATCH_SIZE);
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const filtered = characters.filter((c) => {
    if (!nsfwMode && c.is_nsfw) return false;
    if (filter === "All") return true;
    if (filter === "SFW Only") return !c.is_nsfw;
    if (filter === "NSFW Only") return c.is_nsfw;
    const f = filter.toLowerCase();
    if (FILTER_CATEGORIES.includes(filter) || NSFW_CATEGORIES.includes(filter)) {
      return (c.genres ?? []).some((g) => g.toLowerCase().includes(f));
    }
    return c.name.toLowerCase().includes(f) || (c.tagline ?? "").toLowerCase().includes(f);
  });

  const visible = filtered.slice(0, visibleCount);

  const handleFilter = (f: string) => {
    if (f === "NSFW Only" && !nsfwMode) {
      setShowNsfwConfirm(true);
      return;
    }
    setFilter(f);
  };

  const enableNsfw = () => {
    setNsfwMode(true);
    setFilter("NSFW Only");
    setShowNsfwConfirm(false);
  };

  const pills = ["All", "SFW Only", "NSFW Only"];
  const categories = nsfwMode ? [...FILTER_CATEGORIES, ...NSFW_CATEGORIES] : FILTER_CATEGORIES;

  return (
    <main className="min-h-screen bg-background text-foreground px-4 sm:px-6 pt-20 md:pt-24 pb-14 md:pb-0">
      <div
        className="fixed top-14 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-accent-candle to-accent-rose transition-[width] duration-150"
        style={{ width: `${scrollProgress}%` }}
      />

      <section className="mx-auto max-w-6xl pb-8">
        <p className="text-[11px] uppercase tracking-[0.35em] text-accent-candle font-semibold">
          Anonymous AI matchmaking
        </p>
        <h1 className="mt-3 font-retro text-4xl md:text-6xl leading-[1.04] text-foreground max-w-3xl">
          Meet your scene <span className="gradient-text">tonight.</span>
        </h1>
        <p className="mt-4 text-sm md:text-base text-muted max-w-xl">
          Real chemistry, no faces required. Pick a character, step into a scene, reveal only when you both want to.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/create"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-dark px-6 text-sm font-semibold text-accent-foreground shadow-[0_8px_30px_-12px_var(--brand)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ios-press"
          >
            <span aria-hidden="true">+</span> Create a character
          </Link>
          <Link
            href="/matchmake"
            className="inline-flex h-11 items-center rounded-full border border-line-strong px-6 text-sm font-medium text-foreground transition-colors duration-200 hover:border-accent-candle hover:text-accent-candle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ios-press"
          >
            Find a match
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-faint"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              placeholder="Search characters..."
              onChange={(e) => setFilter(e.target.value.trim() === "" ? "All" : e.target.value)}
              className="h-11 w-full rounded-full border border-line bg-surface pl-11 pr-4 text-sm text-foreground placeholder:text-muted-faint focus:border-line-focus focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((o) => !o)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm text-muted transition-colors hover:border-line-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ios-press"
              aria-expanded={sortOpen}
              aria-haspopup="listbox"
            >
              <span className="font-mono text-xs uppercase tracking-wider text-accent-candle">{sortSub}</span>
              <span>{sortMode}</span>
              <svg
                className={`h-3.5 w-3.5 transition-transform ${sortOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {sortOpen && (
              <div className="ios-dropdown ios-frosted absolute right-0 top-13 z-30 w-56 rounded-2xl border border-line p-2">
                {SORT_MODES.map((mode) => (
                  <div key={mode} className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-muted-faint">
                    {mode}
                  </div>
                ))}
                {Object.entries(SORT_SUBS).map(([mode, subs]) => (
                  <div key={mode}>
                    {subs.map((sub) => (
                      <button
                        key={`${mode}-${sub}`}
                        type="button"
                        onClick={() => {
                          setSortMode(mode);
                          setSortSub(sub);
                          setSortOpen(false);
                        }}
                        className={`ios-row flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                          sortMode === mode && sortSub === sub ? "text-accent-candle" : "text-foreground"
                        }`}
                      >
                        <span>{sub}</span>
                        {sortMode === mode && sortSub === sub && (
                          <span className="h-1.5 w-1.5 rounded-full bg-accent-candle" aria-hidden="true" />
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="scrollbar-none mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          {pills.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleFilter(p)}
              className={`h-9 shrink-0 rounded-full border px-4 text-xs font-semibold transition-all duration-200 ios-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                filter === p
                  ? p === "NSFW Only"
                    ? "border-accent-rose bg-accent-rose text-accent-foreground"
                    : "border-accent bg-accent text-accent-foreground"
                  : "border-line bg-surface text-muted hover:border-line-strong hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
          <div className="mx-1 h-6 w-px shrink-0 bg-line-strong" aria-hidden="true" />
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleFilter(c)}
              className={`h-9 shrink-0 rounded-full border px-4 text-xs font-medium transition-all duration-200 ios-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                filter === c
                  ? "border-accent-candle bg-accent-candle/15 text-accent-candle"
                  : NSFW_CATEGORIES.includes(c)
                    ? "border-line bg-surface text-accent-rose/80 hover:border-accent-rose/50 hover:text-accent-rose"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-6xl">
        {loading ? (
          <div className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="ios-card mx-auto max-w-md border border-line p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-candle/15">
              <span className="text-xl text-accent-candle" aria-hidden="true">
                ♥
              </span>
            </div>
            <h2 className="font-retro text-xl text-foreground">No characters yet</h2>
            <p className="mt-2 text-sm text-muted">
              The scene is quiet. Be the first to light it up with a character people can meet tonight.
            </p>
            <Link
              href="/create"
              className="mt-6 inline-flex h-11 items-center rounded-full bg-gradient-to-r from-brand to-brand-dark px-6 text-sm font-semibold text-accent-foreground transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ios-press"
            >
              Create the first one
            </Link>
          </div>
        ) : (
          <div className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((c, i) => {
              const featured = i === 0;
              return (
                <Link
                  key={c.id}
                  href={`/chat/${c.id}`}
                  className={`group relative flex min-w-[45%] shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition-all duration-200 ios-press hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_16px_40px_-16px_oklch(0.12_0.02_285_/_0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus md:min-w-0 ${
                    featured ? "min-w-[70%] md:col-span-2" : ""
                  }`}
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden">
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={c.name}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <CardArt name={c.name} />
                    )}
                    {featured && (
                      <span className="absolute left-3 top-3 rounded-full bg-accent-candle px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                        Tonight&rsquo;s pick
                      </span>
                    )}
                    {c.is_nsfw && (
                      <span className="absolute right-3 top-3 rounded-full bg-accent-rose/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                        18+
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="truncate text-base font-semibold text-foreground transition-colors group-hover:text-accent-candle">
                      {c.name}
                    </p>
                    {c.tagline && <p className="truncate text-xs text-muted">{c.tagline}</p>}
                    {(c.genres ?? []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(c.genres ?? []).slice(0, 2).map((g) => (
                          <span
                            key={g}
                            className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-muted"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <div ref={sentinelRef} className="h-10" />
        {!loading && visible.length < filtered.length && (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent-candle" aria-hidden="true" />
          </div>
        )}
      </section>

      <footer className="mx-auto mt-16 max-w-6xl border-t border-line pt-6 pb-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-faint">
          16+ to join · 18+ for NSFW
        </p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted">© 2026 SweetScene</p>
          <Link
            href="/safety"
            className="text-xs text-muted underline-offset-4 transition-colors hover:text-accent-candle hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            Safety
          </Link>
        </div>
      </footer>

      {showNsfwConfirm && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
          <div className="ios-sheet ios-frosted mx-auto max-w-md rounded-[calc(var(--radius-card)*1.25)] border border-line p-6">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />
            <p className="font-retro text-lg text-foreground">This section is 18+</p>
            <p className="mt-2 text-sm text-muted">
              Adult content is gated to verified adults. 16+ to join, 18+ for NSFW.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={enableNsfw}
                className="h-11 flex-1 rounded-full bg-accent-rose px-4 text-sm font-semibold text-accent-foreground transition-transform duration-200 ios-press hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
              >
                I&rsquo;m 18 or older
              </button>
              <button
                type="button"
                onClick={() => setShowNsfwConfirm(false)}
                className="h-11 flex-1 rounded-full border border-line-strong px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ios-press"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
