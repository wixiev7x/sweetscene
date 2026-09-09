"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/utils/sound";

interface BotCard {
  id: string;
  name: string;
  tagline: string | null;
  is_nsfw: boolean | null;
  gender: string | null;
}

type RecFilter = "female" | "male" | "everyone";

const FILTERS: { key: RecFilter; label: string }[] = [
  { key: "female", label: "Her" },
  { key: "male", label: "Him" },
  { key: "everyone", label: "Everyone" },
];

export function SuggestedBots({ kinkTags, showFilter = false }: { kinkTags: string[]; showFilter?: boolean }) {
  const [bots, setBots] = useState<BotCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<RecFilter>("everyone");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("bots")
          .select("id, name, tagline, is_nsfw, gender")
          .limit(20);
        if (!cancelled && error) {
          setFailed(true);
        } else if (!cancelled && data) {
          const shuffled = (data as BotCard[]).slice().sort(() => Math.random() - 0.5);
          setBots(shuffled);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kinkTags, reloadKey]);

  const visible = (
    filter === "everyone" ? bots : bots.filter((b) => b.gender === filter)
  ).slice(0, 4);

  const genderLabel = (g: string | null) =>
    g === "female" ? "F" : g === "male" ? "M" : null;

  return (
    <div className="px-4 pb-8 pt-2">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-foreground">Scene for one while you wait</p>
        {showFilter && !loading && bots.length > 0 && (
          <div className="flex gap-1" role="group" aria-label="Filter recommendations">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFilter(f.key);
                  playSound("click");
                }}
                aria-pressed={filter === f.key}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none ${
                  filter === f.key
                    ? "bg-accent-candle/15 text-accent-candle border-accent-candle/40"
                    : "bg-surface-sunken text-muted border-line hover:border-line-strong hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {showFilter && (
        <p className="text-xs text-muted mb-3">Solo scenes open in a new tab — your queue keeps running.</p>
      )}

      {loading ? (
        <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-36">
              <div className="aspect-[3/4] rounded-[16px] bg-foreground/5 animate-pulse" />
              <div className="h-3 bg-foreground/5 rounded animate-pulse mt-2" />
            </div>
          ))}
        </div>
      ) : failed ? (
        <div className="py-3">
          <p className="text-xs text-muted-faint">
            Couldn&rsquo;t load character suggestions.
          </p>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-1.5 text-xs text-accent-candle hover:text-accent-candle-deep focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none rounded px-1"
          >
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-xs text-muted-faint py-3">
          No characters in this lane yet — the community is still growing.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-2">
          {visible.map((bot) => (
            <a
              key={bot.id}
              href={`/play/${bot.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="snap-start flex-shrink-0 w-36 text-left ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none rounded-lg"
            >
              <div className="relative aspect-[3/4] rounded-[16px] bg-gradient-to-br from-foreground/10 to-foreground/5 border border-line flex items-center justify-center mb-2 overflow-hidden">
                <span className="text-3xl font-bold text-foreground/20 font-display">{bot.name.charAt(0).toUpperCase()}</span>
                {genderLabel(bot.gender) && (
                  <span className="absolute top-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-background/70 text-muted border border-line">
                    {genderLabel(bot.gender)}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-foreground truncate">{bot.name}</p>
              <p className="text-xs text-muted truncate">{bot.tagline || "AI character"}</p>
              {bot.is_nsfw && (
                <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-danger/10 text-danger">18+</span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
