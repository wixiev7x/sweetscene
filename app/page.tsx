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
    <div className="md:pl-16 pb-14 md:pb-0">
      {/* Scroll progress heat bar */}
      <div className="fixed top-12 left-0 right-0 h-[2px] z-50 bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-neon-magenta to-crimson-600 transition-[width] duration-75"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      {/* Connection meter — vertical right edge */}
      <div className="fixed right-0 top-12 bottom-14 md:bottom-0 w-[3px] z-40 bg-white/5">
        <div
          className="w-full bg-gradient-to-b from-neon-magenta via-crimson-500 to-neon-purple transition-[height] duration-75"
          style={{ height: `${scrollProgress * 100}%` }}
        />
        <span className="absolute bottom-2 right-4 text-[7px] uppercase tracking-widest text-muted-faint rotate-90 origin-bottom-right whitespace-nowrap">
          CONNECTION
        </span>
      </div>

      {/* Filter row — top, above hero */}
      <section className="px-4 sm:px-6 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2 max-w-7xl mx-auto">
          <button
            onClick={() => { setFilter("All"); playSound("click"); }}
            className={`text-sm px-4 py-2 rounded-md border transition-all ${filter === "All" ? "bg-brand/20 border-brand/40 text-brand-light" : "bg-white/5 border-white/10 text-muted hover:text-foreground-dim"}`}
          >
            All
          </button>
          <button
            onClick={() => { setFilter("SFW Only"); playSound("click"); }}
            className={`text-sm px-4 py-2 rounded-md border transition-all ${filter === "SFW Only" ? "bg-brand/20 border-brand/40 text-brand-light" : "bg-white/5 border-white/10 text-muted hover:text-foreground-dim"}`}
          >
            SFW Only
          </button>
          <button
            onClick={handleNsfwToggle}
            className={`text-sm px-4 py-2 rounded-md border transition-all ${nsfwMode ? "bg-crimson-500/20 border-crimson-500/40 text-crimson-400" : "bg-white/5 border-white/10 text-muted hover:text-foreground-dim"}`}
          >
            NSFW Only
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-7xl mx-auto scrollbar-none">
          {FILTER_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setFilter(cat); playSound("click"); }}
              className={`text-sm px-4 py-2 rounded-md border whitespace-nowrap transition-all ${filter === cat ? "bg-brand/20 border-brand/40 text-brand-light" : "bg-white/5 border-white/10 text-muted hover:text-foreground-dim"}`}
            >
              {cat}
            </button>
          ))}
          {nsfwMode && NSFW_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setFilter(cat); playSound("click"); }}
              className={`text-sm px-4 py-2 rounded-md border whitespace-nowrap transition-all ${filter === cat ? "bg-crimson-500/20 border-crimson-500/40 text-crimson-400" : "bg-crimson-500/5 border-crimson-500/20 text-crimson-400/70 hover:text-crimson-400"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Hero banner — below filter row */}
      <section className="px-4 sm:px-6 pt-2 pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 max-w-7xl mx-auto">
          <div>
            <h1 className="text-xl font-medium text-foreground">Matchmake Yourself</h1>
            <p className="text-sm text-muted">Anonymous first. Reveal only when both agree.</p>
          </div>
          <Link
            href="/create"
            onClick={() => playSound("click")}
            className="text-sm px-5 py-2.5 rounded-md text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all whitespace-nowrap inline-flex items-center gap-2"
          >
            <span className="text-base leading-none">+</span> Create
          </Link>
        </div>
      </section>

      {/* Character grid */}
      <section className="px-4 sm:px-6 pb-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {[...Array(BATCH_SIZE)].map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden animate-pulse">
                  <div className="aspect-[3/4] bg-surface-raised" />
                  <div className="p-3">
                    <div className="h-4 bg-surface-raised rounded w-24 mb-2" />
                    <div className="h-3 bg-surface-raised rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted text-xl mb-2">No characters yet</p>
              <p className="text-muted-faint text-sm mb-6">Be the first to create one.</p>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 text-sm px-6 py-3 rounded-md text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all"
              >
                <span className="text-base leading-none">+</span> Create the first one
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
                      className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-neon-magenta/40 hover:scale-[1.02] transition-all duration-200"
                    >
                      <div className="aspect-[3/4] relative overflow-hidden">
                        <div className={`absolute inset-0 bg-gradient-to-br ${grad} flex items-center justify-center`}>
                          <span className="text-5xl font-bold text-white/30">{c.name[0] || "?"}</span>
                        </div>
                        {c.is_nsfw && (
                          <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-md bg-crimson-500/80 text-white font-bold">
                            18+
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="text-base text-foreground group-hover:text-neon-magenta transition-colors truncate font-medium">
                          {c.name}
                        </h3>
                        {c.tagline && (
                          <p className="text-xs text-muted truncate mt-1">{c.tagline}</p>
                        )}
                        {tags.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2">
                            {tags.map((t) => (
                              <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-neon-magenta/10 text-brand-light">
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
                  <div className="h-6 w-6 border-2 border-white/10 border-t-neon-magenta rounded-full animate-spin" />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Safety link — footer-level, below character listings */}
      <footer className="px-4 sm:px-6 py-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-xs text-muted-faint">&copy; 2025 SweetScene</span>
          <Link href="/safety" className="text-xs text-muted hover:text-foreground-dim transition-colors">
            Safety
          </Link>
        </div>
      </footer>

      {/* Inline 18+ confirmation */}
      {showNsfwConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-void-950/80 backdrop-blur-sm">
          <div className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm mx-4">
            <h2 className="text-base text-foreground mb-2">This section is 18+</h2>
            <p className="text-sm text-muted mb-5">You are about to view NSFW content. Confirm you are 18 or older.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={confirmNsfw}
                className="text-sm px-5 py-2.5 rounded-md text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowNsfwConfirm(false)}
                className="text-sm px-5 py-2.5 rounded-md text-muted bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
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
