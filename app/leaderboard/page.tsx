"use client";

import Link from "next/link";
import { useState } from "react";
import { playSound } from "@/lib/utils/sound";

type Creator = {
  rank: number;
  name: string;
  messages: number;
  characters: number;
  reveals: number;
};

const creators: Creator[] = [
  { rank: 1, name: "User_8890", messages: 45230, characters: 12, reveals: 89 },
  { rank: 2, name: "User_1247", messages: 38120, characters: 9, reveals: 67 },
  { rank: 3, name: "User_3344", messages: 29847, characters: 15, reveals: 52 },
  { rank: 4, name: "User_7782", messages: 22341, characters: 7, reveals: 38 },
  { rank: 5, name: "User_4921", messages: 18204, characters: 11, reveals: 31 },
  { rank: 6, name: "User_5567", messages: 15890, characters: 6, reveals: 25 },
  { rank: 7, name: "User_9921", messages: 12340, characters: 8, reveals: 19 },
  { rank: 8, name: "User_3389", messages: 9876, characters: 5, reveals: 15 },
  { rank: 9, name: "User_7712", messages: 7654, characters: 4, reveals: 12 },
  { rank: 10, name: "User_4421", messages: 5432, characters: 3, reveals: 8 },
];

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
  const [selected, setSelected] = useState<number | null>(null);

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
                    <span className="text-muted">💬 Messages</span>
                    <span className="font-semibold text-foreground">{formatNum(creator.messages)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">🎭 Characters</span>
                    <span className="font-semibold text-foreground">{creator.characters}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">🔓 Reveals</span>
                    <span className="font-semibold text-foreground">{creator.reveals}</span>
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
                  <p className="text-muted-faint text-xs">💬 Messages</p>
                  <p className="font-semibold text-foreground">{formatNum(creator.messages)}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-faint text-xs">🎭 Chars</p>
                  <p className="font-semibold text-foreground">{creator.characters}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-faint text-xs">🔓 Reveals</p>
                  <p className="font-semibold text-foreground">{creator.reveals}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center py-8 border-t border-white/5">
          <p className="text-xl font-semibold gradient-text mb-4">Don't just play scenes. BUILD them.</p>
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
