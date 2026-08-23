"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { playSound } from "@/lib/utils/sound";
import { createClient } from "@/lib/supabase/client";

type Creator = {
  rank: number;
  name: string;
  messages: number;
  characters: number;
  reveals: number;
};

const podiumStyles: Record<number, { card: string; rank: string; label: string }> = {
  1: {
    card: "border-gold-500/40 bg-gold-500/5",
    rank: "text-gold-500",
    label: "text-gold-400",
  },
  2: {
    card: "border-brand/30 bg-brand/5",
    rank: "text-brand-light",
    label: "text-brand-light",
  },
  3: {
    card: "border-crimson-500/30 bg-crimson-500/5",
    rank: "text-crimson-500",
    label: "text-crimson-500",
  },
};

const formatNum = (n: number) => n.toLocaleString();

export default function LeaderboardPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("profiles")
          .select("anonymous_username, reputation_score, earned_tags")
          .order("reputation_score", { ascending: false })
          .limit(10);

        if (error) throw error;

        if (!cancelled && data) {
          const mapped: Creator[] = data.map((p: Record<string, unknown>, i: number) => ({
            rank: i + 1,
            name: (p.anonymous_username as string) || `User_${i + 1}`,
            messages: (p.reputation_score as number) ?? 0,
            characters: 0,
            reveals: 0,
          }));
          setCreators(mapped);
        }
      } catch {
        // show empty state on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreatorClick = (rank: number) => {
    playSound("click");
    setSelected(selected === rank ? null : rank);
  };

  const podium = creators.slice(0, 3);
  const rest = creators.slice(3);

  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold gradient-text mb-2">Creator Leaderboard</h1>
          <p className="text-muted-strong">Top creators ranked by total engagement on their characters.</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-surface/50 border border-white/10 rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-surface-raised rounded" />
                  <div className="w-10 h-10 rounded-full bg-surface-raised" />
                  <div className="flex-1">
                    <div className="h-4 bg-surface-raised rounded w-32 mb-2" />
                    <div className="h-3 bg-surface-raised rounded w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : creators.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted text-lg mb-2">No creators ranked yet</p>
            <p className="text-muted-faint text-sm mb-6">Create characters and start chatting to climb the leaderboard.</p>
            <Link
              href="/create"
              onClick={() => playSound("click")}
              className="inline-block px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors border border-brand/30"
            >
              Create a Character
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {podium.map((creator) => {
                const style = podiumStyles[creator.rank];
                return (
                  <div
                    key={creator.rank}
                    onClick={() => handleCreatorClick(creator.rank)}
                    className={`rounded-2xl p-6 border cursor-pointer transition-all hover:scale-[1.02] ${
                      style.card
                    } ${selected === creator.rank ? "scale-[1.02] pulse-glow" : ""} ${
                      creator.rank === 1 ? "sm:order-2 sm:-translate-y-2" : creator.rank === 2 ? "sm:order-1" : "sm:order-3"
                    }`}
                  >
                    <div className="text-center mb-4">
                      <div className={`text-5xl font-bold ${style.rank} mb-1`}>
                        {creator.rank === 1 && <span className="mr-1">👑</span>}#{creator.rank}
                      </div>
                    </div>
                    <div className="flex justify-center mb-4">
                      <div className="w-14 h-14 rounded-full bg-surface-raised flex items-center justify-center text-brand-light font-bold">
                        {creator.name.slice(-2)}
                      </div>
                    </div>
                    <p className={`text-center text-sm font-semibold mb-4 ${style.label}`}>{creator.name}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">Reputation</span>
                        <span className="font-semibold text-foreground">{formatNum(creator.messages)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 mb-12">
              {rest.map((creator) => (
                <div
                  key={creator.rank}
                  onClick={() => handleCreatorClick(creator.rank)}
                  className={`flex items-center justify-between p-4 bg-surface/50 border rounded-xl cursor-pointer transition-all hover:border-white/20 hover:bg-surface-raised ${
                    selected === creator.rank ? "border-brand/30 bg-surface-raised" : "border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-muted-strong w-8">#{creator.rank}</span>
                    <div className="w-9 h-9 rounded-full bg-surface-raised flex items-center justify-center text-brand-light font-bold text-sm">
                      {creator.name.slice(-2)}
                    </div>
                    <span className="text-sm font-semibold text-foreground">{creator.name}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-muted-faint text-xs">Reputation</p>
                      <p className="font-semibold text-foreground">{formatNum(creator.messages)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="text-center py-8 border-t border-white/5">
          <p className="text-xl font-semibold gradient-text mb-4">Don&apos;t just play scenes. BUILD them.</p>
          <Link
            href="/create"
            onClick={() => playSound("click")}
            className="inline-block px-8 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors border border-brand/30"
          >
            Create a Scene
          </Link>
        </div>
      </div>
    </main>
  );
}
