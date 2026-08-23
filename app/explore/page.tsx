"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { playSound } from "@/lib/utils/sound";
import { createClient } from "@/lib/supabase/client";

type Character = {
  id: string;
  name: string;
  tagline: string;
  genre: string;
  personality: string;
  isNsfw: boolean;
};

const GENRES = ["All", "Romance", "Mystery", "Fantasy", "Sci-Fi", "Slice of Life", "Thriller"];

export default function ExplorePage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const [nsfwEnabled, setNsfwEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("bots")
          .select("id, name, tagline, personality, is_nsfw, genres")
          .limit(50);

        if (error) throw error;

        if (!cancelled && data) {
          const mapped: Character[] = data.map((b: Record<string, unknown>) => {
            const genres = (b.genres as string[]) ?? [];
            return {
              id: b.id as string,
              name: b.name as string,
              tagline: (b.tagline as string) || "",
              genre: genres[0] || "Other",
              personality: (b.personality as string) || "",
              isNsfw: (b.is_nsfw as boolean) ?? false,
            };
          });
          setCharacters(mapped);
        }
      } catch {
        // show empty state on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = characters.filter((c) => {
    if (c.name.toLowerCase().includes(search.toLowerCase()) || c.tagline.toLowerCase().includes(search.toLowerCase())) {
      if (genre === "All" || c.genre === genre) {
        if (c.isNsfw && !nsfwEnabled) return false;
        return true;
      }
    }
    return false;
  });

  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-light text-foreground-dim mb-2">Explore Characters</h1>
        <p className="text-sm text-muted mb-8">Discover AI characters created by the community.</p>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <input type="text" placeholder="Search characters..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-surface/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:ring-2 focus:ring-neon-magenta/50" />
          <button onClick={() => { setNsfwEnabled(!nsfwEnabled); playSound("click"); }}
            className={`px-4 py-3 rounded-xl text-sm border transition-all whitespace-nowrap ${nsfwEnabled ? "bg-crimson-500/20 border-crimson-500/40 text-crimson-400" : "bg-surface/50 border-white/10 text-muted"}`}>
            {nsfwEnabled ? "Adult content enabled" : "Only safe-for-work content is shown"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {GENRES.map((g) => (
            <button key={g} onClick={() => { setGenre(g); playSound("click"); }}
              className={`px-4 py-1.5 rounded-full text-sm border transition-all ${genre === g ? "bg-brand/20 border-brand/40 text-brand-light" : "bg-surface/30 border-white/10 text-muted hover:text-foreground-dim"}`}>
              {g}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-surface/50 border border-white/10 rounded-2xl p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-surface-raised" />
                  <div className="flex-1">
                    <div className="h-4 bg-surface-raised rounded w-24 mb-2" />
                    <div className="h-3 bg-surface-raised rounded w-full mb-1" />
                    <div className="h-3 bg-surface-raised rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted text-lg mb-2">No characters found matching your filters.</p>
            <p className="text-muted-faint text-sm">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <Link key={c.id} href={`/chat/${c.id}`} onClick={() => playSound("click")}
                className="group bg-surface/50 border border-white/10 rounded-2xl p-5 hover:border-brand/30 transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand to-crimson-600 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
                    {c.name[0]}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base text-foreground group-hover:text-brand-light transition-colors">{c.name}</h3>
                    <p className="text-xs text-muted mt-1 line-clamp-2">{c.tagline}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="bg-neon-magenta/10 text-brand-light text-xs rounded-full px-2.5 py-0.5">{c.genre}</span>
                      {c.isNsfw && <span className="bg-crimson-500/10 text-crimson-400 text-xs rounded-full px-2.5 py-0.5">18+</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <Link href="/create" className="text-sm text-brand-light hover:text-brand-lighter underline-offset-4 hover:underline transition-all">
            Don&apos;t see what you like? Create your own →
          </Link>
        </div>
      </div>
    </main>
  );
}
