"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { SiteNav, Spinner } from "@/components/ui";
import { getPublicCharacters } from "@/lib/actions/characters";
import { getRecentSessions } from "@/lib/actions/solo";

type Character = {
  id: string;
  name: string;
  user_prompt: string;
  scenario_tags: string[];
  is_nsfw: boolean;
  personality?: string[];
  avatar_url?: string | null;
  connection_score?: number;
  /* Phase 8A — new fields. */
  short_description?: string | null;
  tags?: string[];
  category?: string;
  chat_count?: number;
};

type RecentSession = {
  id: string;
  character_id: string;
  character_name: string;
  character_avatar_url: string | null;
  message_count: number;
  last_message_preview: string;
  updated_at: string;
};

const ALL_TAGS = [
  "hospital",
  "coffee_shop",
  "mansion",
  "library",
  "gym",
  "noir_office",
  "restaurant",
  "fitness",
  "clinic",
  "home",
  "service",
  "mystery",
];

const GRADIENTS = [
  ["from-brand", "to-crimson-500"],
  ["from-blue-500", "to-cyan-500"],
  ["from-amber-500", "to-red-500"],
  ["from-green-500", "to-teal-500"],
  ["from-indigo-500", "to-violet-500"],
] as const;

/**
 * Derives a gradient index from a character name for the avatar circle.
 */
function hashGradient(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return sum % GRADIENTS.length;
}

/**
 * Browser / showcase page for public AI characters. Users can search,
 * filter by scenario tag and NSFW/SFW, and open a detail modal to
 * preview a character before playing solo.
 */
export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [nsfwFilter, setNsfwFilter] = useState<"all" | "sfw" | "nsfw">("all");
  const [personalityQuery, setPersonalityQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "popular">("recent");
  /* Phase 8A — new filter dimensions. */
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  /* Derived filtered list — computed during render via useMemo rather
     than synced through a state-mirroring effect. */
  const filtered = useMemo(() => {
    let result = characters;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.user_prompt.toLowerCase().includes(q) ||
          (c.short_description ?? "").toLowerCase().includes(q) ||
          (c.personality ?? []).some((p) => p.toLowerCase().includes(q)) ||
          (c.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }

    if (personalityQuery.trim()) {
      const p = personalityQuery.toLowerCase().trim();
      result = result.filter((c) =>
        (c.personality ?? []).some((trait) =>
          trait.toLowerCase().includes(p)
        )
      );
    }

    if (selectedTag) {
      result = result.filter((c) => c.scenario_tags.includes(selectedTag));
    }

    /* Phase 8A — category filter. */
    if (selectedCategory) {
      result = result.filter((c) => c.category === selectedCategory);
    }

    if (nsfwFilter === "sfw") {
      result = result.filter((c) => !c.is_nsfw);
    } else if (nsfwFilter === "nsfw") {
      result = result.filter((c) => c.is_nsfw);
    }

    if (sortBy === "popular") {
      /* Phase 8A — popular sorts by chat_count (new metric) first,
         falling back to connection_score for back-compat. */
      result = [...result].sort(
        (a, b) =>
          (b.chat_count ?? 0) - (a.chat_count ?? 0) ||
          (b.connection_score ?? 0) - (a.connection_score ?? 0)
      );
    }

    return result;
  }, [characters, searchQuery, personalityQuery, selectedTag, selectedCategory, nsfwFilter, sortBy]);

  /* ── fetch on mount ── */
  useEffect(() => {
    async function load() {
      setLoading(true);

      try {
        const result = await getPublicCharacters();

        if ("error" in result) {
          setError(result.error);
          setCharacters([]);
        } else {
          const dbChars: Character[] = result.characters.map((c) => ({
            id: c.id,
            name: c.name,
            user_prompt: c.user_prompt,
            scenario_tags: c.scenario_tags,
            is_nsfw: c.is_nsfw,
            personality: c.personality ?? [],
            avatar_url: c.avatar_url ?? null,
            connection_score: c.connection_score ?? 0,
            /* Phase 8A — new fields. */
            short_description: c.short_description ?? null,
            tags: c.tags ?? [],
            category: c.category ?? "other",
            chat_count: c.chat_count ?? 0,
          }));

          setCharacters(dbChars);
        }
      } catch {
        setCharacters([]);
      }

      /* Fetch recent solo sessions for the "Continue chatting" carousel.
         Silently skipped when the user is not authenticated. */
      try {
        const sessionsResult = await getRecentSessions(5);
        if (!("error" in sessionsResult)) {
          setRecentSessions(sessionsResult.sessions);
        }
      } catch {
        /* Not authenticated or no sessions — carousel stays hidden. */
      }

      setLoading(false);
    }

    load();
  }, []);

  return (
    <div className="min-h-screen bg-void-950 text-white">
      {/* background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,45,149,0.08)_0%,transparent_50%)]" />

      {/* ── NAV BAR ── */}
      <SiteNav />

      {/* ── PAGE HEADER ── */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-8">
        <h1 className="text-3xl font-light text-foreground tracking-wide">
          Character Showcase
        </h1>
        <p className="text-sm text-muted mt-2">
          Browse characters. Play solo. Or bring them into your next
          match.
        </p>
        {error && (
          <p className="text-xs text-amber-400/80 mt-3">
            Couldn&apos;t load community characters — showing defaults.
          </p>
        )}
      </div>

      {/* ── CONTINUE CHATTING CAROUSEL ── */}
      {recentSessions.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pb-8">
          <h2 className="text-sm font-medium text-muted-strong mb-4">
            Continue chatting
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {recentSessions.map((s) => {
              const gIdx = hashGradient(s.character_name);
              const [from, to] = GRADIENTS[gIdx];
              return (
                <Link
                  key={s.id}
                  href={`/play/${s.character_id}?session=${s.id}`}
                  className="shrink-0 w-56 bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-brand/30 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3">
                    {s.character_avatar_url ? (
                      <div
                        className="w-10 h-10 rounded-full bg-cover bg-center shrink-0"
                        style={{
                          backgroundImage: `url(${s.character_avatar_url})`,
                        }}
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${from} ${to} flex items-center justify-center shrink-0`}
                      >
                        <span className="text-sm text-white font-bold">
                          {s.character_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {s.character_name}
                      </p>
                      <p className="text-[10px] text-muted-faint">
                        {s.message_count} messages
                      </p>
                    </div>
                  </div>
                  {s.last_message_preview && (
                    <p className="text-xs text-muted mt-2 truncate">
                      {s.last_message_preview}
                    </p>
                  )}
                  <p className="text-xs text-brand-light mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    Continue &rarr;
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FILTER BAR ── */}
      <div className="sticky top-[65px] z-[5] max-w-6xl mx-auto px-6 pb-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-wrap items-center gap-4">
          {/* name/description search */}
          <input
            type="text"
            placeholder="Search name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 w-56"
          />

          {/* personality search (Phase 2) */}
          <input
            type="text"
            placeholder="Personality (witty, shy…)"
            value={personalityQuery}
            onChange={(e) => setPersonalityQuery(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 w-48"
          />

          {/* sort (Phase 2) */}
          <div className="flex border border-white/10 rounded-lg overflow-hidden">
            {(["recent", "popular"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSortBy(s)}
                className={[
                  "px-3 py-1.5 text-xs uppercase font-medium transition-all capitalize",
                  sortBy === s
                    ? "bg-brand/20 text-brand-lighter"
                    : "text-muted hover:text-foreground-dim",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>

          {/* tag filter */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className={[
                "px-3 py-1.5 rounded-full text-xs border transition-all",
                selectedTag === null
                  ? "border-brand/50 bg-brand/10 text-brand-lighter"
                  : "border-white/10 bg-transparent text-muted-strong hover:text-foreground-dim",
              ].join(" ")}
            >
              All
            </button>
            {ALL_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setSelectedTag((prev) =>
                    prev === tag ? null : tag
                  )
                }
                className={[
                  "px-3 py-1.5 rounded-full text-xs border transition-all capitalize",
                  selectedTag === tag
                    ? "border-brand/50 bg-brand/10 text-brand-lighter"
                    : "border-white/10 bg-transparent text-muted-strong hover:text-foreground-dim",
                ].join(" ")}
              >
                {tag.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          {/* NSFW toggle */}
          <div className="flex border border-white/10 rounded-lg overflow-hidden ml-auto">
            {(["all", "sfw", "nsfw"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setNsfwFilter(opt)}
                className={[
                  "px-3 py-1.5 text-xs uppercase font-medium transition-all",
                  nsfwFilter === opt
                    ? "bg-brand/20 text-brand-lighter"
                    : "text-muted hover:text-foreground-dim",
                ].join(" ")}
              >
                {opt === "all" ? "All" : opt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Phase 8A: category filter chips */}
        <div className="max-w-6xl mx-auto px-6 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={[
                "px-3 py-1.5 rounded-full text-xs border transition-all capitalize",
                !selectedCategory
                  ? "border-brand/50 bg-brand/10 text-brand-lighter"
                  : "border-white/10 bg-transparent text-muted hover:text-foreground-dim",
              ].join(" ")}
            >
              All Categories
            </button>
            {["companion", "roleplay", "adventure", "romance", "assistant", "other"].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  setSelectedCategory((prev) => (prev === cat ? null : cat))
                }
                className={[
                  "px-3 py-1.5 rounded-full text-xs border transition-all capitalize",
                  selectedCategory === cat
                    ? "border-brand/50 bg-brand/10 text-brand-lighter"
                    : "border-white/10 bg-transparent text-muted hover:text-foreground-dim",
                ].join(" ")}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CHARACTER GRID ── */}
      <div className="max-w-6xl mx-auto px-6 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Spinner />
            <p className="text-muted text-sm">
              Loading characters...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-20 text-muted-faint text-sm italic">
            No characters match your filters.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filtered.map((char) => {
              const gIdx = hashGradient(char.name);
              const [from, to] = GRADIENTS[gIdx];

              return (
                <Link
                  key={char.id}
                  href={`/characters/${char.id}`}
                  className="relative bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-brand/30 hover:bg-white/[0.07] transition-all duration-300 group text-left w-full block"
                >
                  {/* NSFW badge */}
                  {char.is_nsfw ? (
                    <span className="absolute top-3 right-3 text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                      NSFW
                    </span>
                  ) : (
                    <span className="absolute top-3 right-3 text-[10px] font-bold uppercase bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
                      SFW
                    </span>
                  )}

                  {/* avatar */}
                  {char.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={char.avatar_url}
                      alt={char.name}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-14 h-14 rounded-full bg-gradient-to-br ${from} ${to} flex items-center justify-center`}
                    >
                      <span className="text-xl text-white font-bold">
                        {char.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* name */}
                  <h3 className="text-lg font-medium text-white mt-3 truncate">
                    {char.name}
                  </h3>

                  {/* connection score */}
                  {(char.connection_score ?? 0) > 0 && (
                    <p className="text-[10px] text-brand-light/70 mt-0.5">
                      ◆ {char.connection_score} connections
                    </p>
                  )}

                  {/* personality chips */}
                  {(char.personality ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(char.personality ?? []).slice(0, 3).map((p) => (
                        <span
                          key={p}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand-lighter/80"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* scenario tags */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {char.scenario_tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted capitalize"
                      >
                        {tag.replace(/_/g, " ")}
                      </span>
                    ))}
                    {char.scenario_tags.length > 3 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-faint">
                        +{char.scenario_tags.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Phase 8A: show short_description (new) or fall back to user_prompt. */}
                  <p className="text-sm text-muted-strong mt-3 leading-snug line-clamp-2">
                    {char.short_description ?? char.user_prompt}
                  </p>

                  {/* Phase 8A: new tags + chat count + category */}
                  {(char.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(char.tags ?? []).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300/80 capitalize"
                        >
                          {tag}
                        </span>
                      ))}
                      {(char.tags ?? []).length > 3 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-faint">
                          +{(char.tags ?? []).length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Phase 8A: chat count (replaces connection_score on the card face) */}
                  {(char.chat_count ?? 0) > 0 && (
                    <p className="text-[10px] text-brand-light/70 mt-1">
                      &#128172; {char.chat_count} chats
                    </p>
                  )}

                  {/* play hint */}
                  <span className="block text-xs text-brand-light mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    &#9654; View
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DETAIL MODAL ── */}
      {selectedCharacter && (
        <div
          className="fixed inset-0 z-40 bg-void-950/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setSelectedCharacter(null)}
        >
          {(() => {
            const char = selectedCharacter;
            const gIdx = hashGradient(char.name);
            const [from, to] = GRADIENTS[gIdx];

            return (
              <div
                className="relative max-w-md w-full bg-gradient-to-b from-white/[0.08] to-white/[0.03] border border-white/10 rounded-3xl p-8"
                onClick={(e) => e.stopPropagation()}
              >
                {/* close button */}
                <button
                  type="button"
                  onClick={() => setSelectedCharacter(null)}
                  className="absolute top-4 right-4 text-muted hover:text-foreground-dim text-sm transition-colors"
                >
                  &#10005;
                </button>

                {/* avatar */}
                <div className="flex justify-center">
                  <div
                    className={`w-20 h-20 rounded-full bg-gradient-to-br ${from} ${to} flex items-center justify-center`}
                  >
                    <span className="text-2xl text-white font-bold">
                      {char.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* name */}
                <h2 className="text-2xl font-medium text-white mt-4 text-center">
                  {char.name}
                </h2>

                {/* nsfw badge */}
                <div className="flex justify-center mt-2">
                  <span
                    className={[
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                      char.is_nsfw
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : "bg-green-500/10 text-green-400 border-green-500/20",
                    ].join(" ")}
                  >
                    {char.is_nsfw ? "NSFW" : "SFW"}
                  </span>
                </div>

                {/* tags */}
                <div className="flex flex-wrap gap-2 justify-center mt-3">
                  {char.scenario_tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-1 rounded-full bg-white/5 text-muted-strong capitalize"
                    >
                      {tag.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>

                {/* prompt */}
                <p className="text-xs text-muted uppercase tracking-wider mt-6">
                  Character Prompt
                </p>
                <div className="text-sm text-foreground-dim leading-relaxed mt-2 bg-white/5 rounded-xl p-4">
                  {char.user_prompt}
                </div>

                {/* divider */}
                <div className="bg-gradient-to-r from-transparent via-white/10 to-transparent h-px my-6" />

                {/* play button */}
                <Link
                  href={`/play/${char.id}`}
                  className="block text-center w-full bg-gradient-to-r from-brand-dark to-crimson-600 text-white font-medium py-3 rounded-xl hover:from-brand hover:to-crimson-500 active:scale-95 transform transition-all"
                >
                  &#9654; Play Solo
                </Link>

                {/* close text */}
                <button
                  type="button"
                  onClick={() => setSelectedCharacter(null)}
                  className="block w-full text-sm text-muted hover:text-foreground-dim transition-colors text-center mt-3"
                >
                  Close
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── LINE-CLAMP UTILITY ── */}
      <style jsx>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
