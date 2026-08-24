"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

import { playSound } from "@/lib/utils/sound";
import { createClient } from "@/lib/supabase/client";

const FILTER_CATEGORIES = ["Hot Picks", "New", "Girlfriend", "Boyfriend", "Anime", "Gaming", "All Tags"];
const NSFW_CATEGORIES = ["NSFW", "Dominant", "Submissive", "Taboo"];

type Character = {
  id: string;
  name: string;
  tagline: string;
  is_nsfw: boolean;
  genres: string[];
};

const GRADIENTS = [
  "from-brand to-crimson-600",
  "from-neon-purple to-brand",
  "from-crimson-500 to-brand-dark",
  "from-brand-light to-neon-purple",
  "from-crimson-600 to-gold-600",
  "from-neon-purple to-crimson-500",
  "from-brand-dark to-neon-purple",
  "from-gold-500 to-brand",
];

const BATCH_SIZE = 12;

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
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
  const [sortMode, setSortMode] = useState("Popular");
  const [sortSub, setSortSub] = useState("This Week");
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("bots")
          .select("id, name, tagline, is_nsfw, genres")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        if (!cancelled && data && data.length > 0) {
          setCharacters(data.map((b: Record<string, unknown>) => ({
            id: b.id as string,
            name: b.name as string,
            tagline: (b.tagline as string) || "",
            is_nsfw: (b.is_nsfw as boolean) ?? false,
            genres: (b.genres as string[]) ?? [],
          })));
        }
      } catch {
        // empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? Math.min(1, scrollTop / docHeight) : 0);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const filtered = characters.filter((c) => {
    if (c.is_nsfw && !nsfwMode) return false;
    if (filter === "SFW Only" && c.is_nsfw) return false;
    if (filter === "NSFW Only" && !c.is_nsfw) return false;
    return true;
  });

  const visible = filtered.slice(0, visibleCount);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filtered.length) {
          setVisibleCount((c) => Math.min(c + BATCH_SIZE, filtered.length));
        }
      },
      { rootMargin: "300px" }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [visibleCount, filtered.length]);

  function handleNsfwToggle() {
    if (!nsfwMode) {
      setShowNsfwConfirm(true);
    } else {
      setNsfwMode(false);
    }
  }

  function confirmNsfw() {
    setNsfwMode(true);
    setShowNsfwConfirm(false);
    playSound("click");
  }

  return (
    <div className="pb-14 md:pb-0">
      {/* Scroll progress — subtle iOS-style */}
      <div className="fixed top-14 left-0 right-0 h-[2px] z-50 bg-transparent">
        <div
          className="h-full bg-brand transition-[width] duration-150"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      {/* Search bar */}
      <section className="px-4 sm:px-6 pt-5 pb-4">
        <div className="max-w-7xl mx-auto">
          <div className="relative">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ios-text-tertiary)] pointer-events-none">
              <path d="M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search characters..."
              onChange={(e) => {
                const q = e.target.value.toLowerCase();
                setFilter(q ? q : "All");
              }}
              className="w-full bg-white/5 border border-[var(--ios-hairline)] rounded-full pl-11 pr-4 text-[15px] text-white placeholder-[var(--ios-text-tertiary)] focus:outline-none focus:border-brand/30 transition-all"
              style={{ height: "44px" }}
            />
          </div>
        </div>
      </section>

      {/* Sort dropdown — Popular / New / Top with sub-options */}
      <section className="px-4 sm:px-6 pb-3">
        <div className="max-w-7xl mx-auto relative inline-block">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="ios-press flex items-center gap-2 rounded-full bg-white/10 px-5 text-[15px] font-medium text-white transition-all hover:bg-white/15"
            style={{ height: "40px" }}
          >
            <span>{sortMode}</span>
            <span className="text-[var(--ios-text-tertiary)] text-[13px]">· {sortSub}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${sortOpen ? "rotate-180" : ""}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {sortOpen && (
            <div className="ios-dropdown absolute left-0 top-11 w-56 ios-card ios-frosted border border-[var(--ios-hairline)] p-2 z-50">
              {["Popular", "New", "Top"].map((mode) => {
                const subs = mode === "Popular" ? ["This Week", "This Month", "All Time"] : mode === "New" ? ["Today", "This Week", "This Month"] : ["This Month", "This Year", "All Time"];
                return (
                  <div key={mode} className="mb-1">
                    <button
                      onClick={() => { setSortMode(mode); setSortSub(subs[0]); playSound("click"); }}
                      className={`ios-press w-full text-left px-3 py-2 rounded-[10px] text-[15px] transition-all ${
                        sortMode === mode ? "bg-white/10 text-white font-medium" : "text-[var(--ios-text-secondary)] hover:bg-white/5"
                      }`}
                    >
                      {mode}
                    </button>
                    {sortMode === mode && (
                      <div className="pl-3">
                        {subs.map((sub) => (
                          <button
                            key={sub}
                            onClick={() => { setSortSub(sub); setSortOpen(false); playSound("click"); }}
                            className={`ios-press w-full text-left px-3 py-1.5 rounded-[8px] text-[13px] transition-all ${
                              sortSub === sub ? "text-brand font-medium" : "text-[var(--ios-text-tertiary)] hover:text-white"
                            }`}
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* iOS Tag pills — horizontal scroll */}
      <section className="px-4 sm:px-6 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-7xl mx-auto scrollbar-none">
          {/* SFW / NSFW toggle pills */}
          <button
            onClick={() => { setFilter("All"); playSound("click"); }}
            className={`ios-press rounded-full px-4 text-[15px] font-medium whitespace-nowrap transition-all ${
              filter === "All" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/15"
            }`}
            style={{ height: "40px" }}
          >
            All
          </button>
          <button
            onClick={() => { setFilter("SFW Only"); playSound("click"); }}
            className={`ios-press rounded-full px-4 text-[15px] font-medium whitespace-nowrap transition-all ${
              filter === "SFW Only" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/15"
            }`}
            style={{ height: "40px" }}
          >
            SFW
          </button>
          <button
            onClick={handleNsfwToggle}
            className={`ios-press rounded-full px-4 text-[15px] font-medium whitespace-nowrap transition-all ${
              nsfwMode ? "bg-ios-red text-white" : "bg-white/10 text-white hover:bg-white/15"
            }`}
            style={{ height: "40px" }}
          >
            NSFW
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-[var(--ios-hairline)] flex-shrink-0" />

          {/* Category pills */}
          {FILTER_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setFilter(cat); playSound("click"); }}
              className={`ios-press rounded-full px-4 text-[15px] font-medium whitespace-nowrap transition-all ${
                filter === cat ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/15"
              }`}
              style={{ height: "40px" }}
            >
              {cat}
            </button>
          ))}
          {nsfwMode && NSFW_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setFilter(cat); playSound("click"); }}
              className={`ios-press rounded-full px-4 text-[15px] font-medium whitespace-nowrap transition-all ${
                filter === cat ? "bg-ios-red text-white" : "bg-ios-red/15 text-ios-red hover:bg-ios-red/25"
              }`}
              style={{ height: "40px" }}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Character grid */}
      <section className="px-4 sm:px-6 pb-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {[...Array(BATCH_SIZE)].map((_, i) => (
                <div key={i} className="ios-card overflow-hidden animate-pulse">
                  <div className="aspect-[3/4] bg-ios-secondary" />
                  <div className="p-3">
                    <div className="h-4 bg-ios-secondary rounded w-24 mb-2" />
                    <div className="h-3 bg-ios-secondary rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-white text-[19px] font-semibold mb-2">No characters yet</p>
              <p className="text-[var(--ios-text-secondary)] text-[15px] mb-6">Be the first to create one.</p>
              <Link
                href="/create"
                className="ios-press inline-flex items-center gap-2 text-[17px] font-semibold px-6 rounded-full text-white transition-all hover:opacity-90"
                style={{ height: "52px", background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create the first one
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {visible.map((c) => {
                  const grad = GRADIENTS[hashStr(c.name) % GRADIENTS.length];
                  const tags = (c.genres || []).slice(0, 2);
                  return (
                    <Link
                      key={c.id}
                      href={`/chat/${c.id}`}
                      onClick={() => playSound("click")}
                      className="ios-press group ios-card overflow-hidden hover:opacity-95 transition-all"
                    >
                      <div className="aspect-[3/4] relative overflow-hidden">
                        <div className={`absolute inset-0 bg-gradient-to-br ${grad} flex items-center justify-center`}>
                          <span className="text-5xl font-bold text-white/30">{c.name[0] || "?"}</span>
                        </div>
                        {c.is_nsfw && (
                          <span className="absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded-full bg-ios-red text-white font-bold">
                            18+
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="text-[17px] text-white group-hover:text-brand transition-colors truncate font-medium">
                          {c.name}
                        </h3>
                        {c.tagline && (
                          <p className="text-[13px] text-[var(--ios-text-secondary)] truncate mt-1">{c.tagline}</p>
                        )}
                        {tags.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2">
                            {tags.map((t) => (
                              <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
              {/* Infinite scroll sentinel */}
              {visibleCount < filtered.length && (
                <div ref={sentinelRef} className="flex items-center justify-center py-8">
                  <div className="w-7 h-7 border-2 border-white/10 border-t-brand rounded-full animate-spin" />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Safety link — footer */}
      <footer className="px-4 sm:px-6 py-6 border-t border-[var(--ios-hairline)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-[13px] text-[var(--ios-text-tertiary)]">&copy; 2025 SweetScene</span>
          <Link href="/safety" className="text-[13px] text-[var(--ios-text-secondary)] hover:text-white transition-colors">
            Safety
          </Link>
        </div>
      </footer>

      {/* Inline 18+ confirmation — iOS sheet */}
      {showNsfwConfirm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowNsfwConfirm(false)}>
          <div
            className="ios-sheet w-full max-w-md rounded-t-[24px] ios-frosted border-t border-[var(--ios-hairline)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[var(--ios-hairline)] rounded-full mx-auto mb-5" />
            <h2 className="text-[19px] font-semibold text-white mb-2">This section is 18+</h2>
            <p className="text-[15px] text-[var(--ios-text-secondary)] mb-6">You are about to view NSFW content. Confirm you are 18 or older.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmNsfw}
                className="ios-press w-full rounded-full text-white font-semibold text-[17px] transition-all hover:opacity-90"
                style={{ height: "52px", background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" }}
              >
                Confirm
              </button>
              <button
                onClick={() => setShowNsfwConfirm(false)}
                className="ios-press w-full rounded-full text-white text-[17px] bg-white/10 hover:bg-white/15 transition-all"
                style={{ height: "52px" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
