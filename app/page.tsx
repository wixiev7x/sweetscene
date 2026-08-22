"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

import { playSound } from "@/lib/utils/sound";
import { createClient } from "@/lib/supabase/client";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STEPS = [
  { emoji: "\u{1F52E}", title: "Match Anonymously", desc: "Our AI pairs you on shared interests, not faces. Pick a scene, get matched instantly." },
  { emoji: "\u{1F3AD}", title: "Roleplay Together", desc: "An AI director joins your chat, breaks the ice, and keeps the scene alive with curveball prompts." },
  { emoji: "\u{1F32B}\uFE0F", title: "Reveal or Fade", desc: "When BOTH click Unmask, the blur drops. Stay anonymous forever or walk away." },
];

const SCENARIOS = [
  { name: "Late-Night Diner", emoji: "\u{1F374}", desc: "3am, greasy fries, a jukebox that only plays one song on repeat. The AI keeps throwing curveball questions at you both until sunrise." },
  { name: "Rooftop Stargazing", emoji: "\u{1F31F}", desc: "Ten minutes until the show starts. No names, just a shared blanket and a skyline." },
  { name: "Train Compartment", emoji: "\u{1F686}", desc: "You both swiped Anonymous. The AI seals the compartment doors. Six hours to the next stop." },
  { name: "Airport Lounge", emoji: "\u2708\uFE0F", desc: "Delayed flight. Shared charger. The AI narrates your layover like a rom-com trailer." },
  { name: "Food Truck Festival", emoji: "\u{1F32D}", desc: "Last two in line. Rain starts. The AI makes you share an umbrella and opinions." },
  { name: "Masquerade Ball", emoji: "\u{1F3AD}", desc: "Masks on. The AI assigns secret identities. Dance with a stranger who might be anyone." },
];

const ACTIVITY = [
  { text: "New blind match formed in Train Compartment", time: "just now" },
  { text: "User_7734 just unmasked after a 2hr scene", time: "12s ago" },
  { text: "User_1104 earned the Marathon Talker badge", time: "34s ago" },
  { text: "New character published: The Moonlit Witch", time: "1m ago" },
  { text: "Rooftop Stargazing scene reached 3,000 watchers", time: "2m ago" },
  { text: "Anonymous confession posted: \u2018We talked till 4am...\u2019", time: "3m ago" },
];

const FEATURES = [
  { title: "THE BLIND MATCH", desc: "30-min scene together. Timer hits zero \u2014 reveal or lose match forever.", href: "/scenarios" },
  { title: "AI-GUIDED ROLEPLAY", desc: "Pre-built scenes with AI driving conversation. Just show up.", href: "/explore" },
  { title: "UNMASK TOGETHER", desc: "Mutual consent only. When BOTH click Unmask, the blur drops.", href: "/bounties" },
  { title: "CREATE CHARACTERS", desc: "Design AI personalities for others to interact with.", href: "/create" },
];

const FAQ = [
  { q: "What if I don't want to unmask?", a: "You never have to. Reveal is 100% mutual consent. Stay anonymous forever or walk away \u2014 both are valid." },
  { q: "Will my chats leak?", a: "Your scenes stay in the dark until you say otherwise. Messages are encrypted at rest." },
  { q: "Is this like a dating app?", a: "No. It's a roleplay-first platform. You match on shared interests, build connection through scenes, and reveal only if you both choose to." },
  { q: "What does the AI do?", a: "The AI director breaks the ice, throws curveball prompts, and keeps the scene alive. Every 6 messages, it steps in to keep things moving." },
];

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

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);
  const [filter, setFilter] = useState("All");
  const [nsfwMode, setNsfwMode] = useState(false);
  const [showNsfwConfirm, setShowNsfwConfirm] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const fetchCharacters = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bots")
        .select("id, name, tagline, is_nsfw, genres")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data && data.length > 0) {
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

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

  const filtered = characters.filter((c) => {
    if (c.is_nsfw && !nsfwMode) return false;
    if (filter === "SFW Only" && c.is_nsfw) return false;
    if (filter === "NSFW Only" && !c.is_nsfw) return false;
    return true;
  });

  const visible = filtered.slice(0, visibleCount);

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

      {/* Slim banner */}
      <section className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 max-w-7xl mx-auto">
          <div>
            <h1 className="text-lg font-light text-foreground">Matchmake Yourself</h1>
            <p className="text-xs text-muted">Anonymous first. Reveal only when both agree.</p>
          </div>
          <Link
            href="/quiz"
            onClick={() => playSound("matchSearch")}
            className="text-xs px-5 py-2 rounded-full text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all whitespace-nowrap"
          >
            Start Matching
          </Link>
        </div>
      </section>

      {/* Filter row */}
      <section className="px-4 sm:px-6 pb-4">
        <div className="flex items-center gap-2 mb-3 max-w-7xl mx-auto">
          <button
            onClick={() => { setFilter("All"); playSound("click"); }}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filter === "All" ? "bg-brand/20 border-brand/40 text-brand-light" : "bg-white/5 border-white/10 text-muted hover:text-foreground-dim"}`}
          >
            All
          </button>
          <button
            onClick={() => { setFilter("SFW Only"); playSound("click"); }}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filter === "SFW Only" ? "bg-brand/20 border-brand/40 text-brand-light" : "bg-white/5 border-white/10 text-muted hover:text-foreground-dim"}`}
          >
            SFW Only
          </button>
          <button
            onClick={handleNsfwToggle}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${nsfwMode ? "bg-crimson-500/20 border-crimson-500/40 text-crimson-400" : "bg-white/5 border-white/10 text-muted hover:text-foreground-dim"}`}
          >
            NSFW Only
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 max-w-7xl mx-auto scrollbar-none">
          {FILTER_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setFilter(cat); playSound("click"); }}
              className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-all ${filter === cat ? "bg-brand/20 border-brand/40 text-brand-light" : "bg-white/5 border-white/10 text-muted hover:text-foreground-dim"}`}
            >
              {cat}
            </button>
          ))}
          {nsfwMode && NSFW_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setFilter(cat); playSound("click"); }}
              className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-all ${filter === cat ? "bg-crimson-500/20 border-crimson-500/40 text-crimson-400" : "bg-crimson-500/5 border-crimson-500/20 text-crimson-400/70 hover:text-crimson-400"}`}
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
              {[...Array(10)].map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden animate-pulse">
                  <div className="aspect-[3/4] bg-surface-raised" />
                  <div className="p-2.5">
                    <div className="h-3 bg-surface-raised rounded w-20 mb-1.5" />
                    <div className="h-2.5 bg-surface-raised rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted text-lg mb-2">No characters yet</p>
              <p className="text-muted-faint text-sm mb-6">Be the first to create one.</p>
              <Link
                href="/create"
                className="inline-block text-xs px-5 py-2.5 rounded-full text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson--500 transition-all"
              >
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
                      className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-neon-magenta/40 hover:scale-[1.02] transition-all duration-200"
                    >
                      <div className="aspect-[3/4] relative overflow-hidden">
                        <div className={`absolute inset-0 bg-gradient-to-br ${grad} flex items-center justify-center`}>
                          <span className="text-4xl font-bold text-white/30">{c.name[0] || "?"}</span>
                        </div>
                        {c.is_nsfw && (
                          <span className="absolute top-1.5 right-1.5 text-[8px] px-1.5 py-0.5 rounded-full bg-crimson-500/80 text-white font-bold">
                            18+
                          </span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <h3 className="text-sm text-foreground group-hover:text-neon-magenta transition-colors truncate">
                          {c.name}
                        </h3>
                        {c.tagline && (
                          <p className="text-[11px] text-muted truncate mt-0.5">{c.tagline}</p>
                        )}
                        {tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5">
                            {tags.map((t) => (
                              <span key={t} className="text-[8px] px-1.5 py-0.5 rounded-full bg-neon-magenta/10 text-brand-light">
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
              {visibleCount < filtered.length && (
                <div className="text-center mt-6">
                  <button
                    onClick={() => { setVisibleCount((c) => c + 20); playSound("click"); }}
                    className="text-xs px-6 py-2.5 rounded-full text-foreground bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Inline 18+ confirmation */}
      {showNsfwConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-void-950/80 backdrop-blur-sm">
          <div className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm mx-4">
            <h2 className="text-base text-foreground mb-2">This section is 18+</h2>
            <p className="text-xs text-muted mb-5">You are about to view NSFW content. Confirm you are 18 or older.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={confirmNsfw}
                className="text-xs px-5 py-2 rounded-full text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowNsfwConfirm(false)}
                className="text-xs px-5 py-2 rounded-full text-muted bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
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
