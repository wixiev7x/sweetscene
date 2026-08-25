"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface BotCard {
  id: string;
  name: string;
  tagline: string | null;
  is_nsfw: boolean | null;
  genres: string[] | null;
}

export function SuggestedBots({ kinkTags }: { kinkTags: string[] }) {
  const [bots, setBots] = useState<BotCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState<BotCard | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        let query = supabase.from("bots").select("id, name, tagline, is_nsfw, genres").limit(10);
        if (kinkTags.length > 0) {
          query = query.overlaps("genres", kinkTags);
        }
        const { data } = await query;
        if (!cancelled && data) setBots(data as BotCard[]);
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kinkTags]);

  if (loading) {
    return (
      <div className="px-4 pb-8">
        <p className="text-sm font-semibold text-foreground mb-1">While you wait</p>
        <p className="text-xs text-muted mb-3">Tap to chat instantly</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-[16px] bg-foreground/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (bots.length === 0) {
    return (
      <div className="px-4 pb-8">
        <p className="text-sm font-semibold text-foreground mb-1">While you wait</p>
        <p className="text-xs text-muted mb-3">Tap to chat instantly</p>
        <p className="text-sm text-muted text-center py-6">No bots match your kinks — try fewer filters.</p>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 pb-8">
        <p className="text-sm font-semibold text-foreground mb-1">While you wait</p>
        <p className="text-xs text-muted mb-3">Tap to chat instantly</p>
        <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory md:grid md:grid-cols-4 lg:grid-cols-5 md:overflow-visible">
          {bots.map((bot) => (
            <button
              key={bot.id}
              onClick={() => setSelectedBot(bot)}
              className="snap-start flex-shrink-0 w-36 md:w-auto text-left ios-press"
            >
              <div className="aspect-[3/4] rounded-[16px] bg-gradient-to-br from-foreground/10 to-foreground/5 border border-white/10 flex items-center justify-center mb-2 overflow-hidden">
                <span className="text-3xl font-bold text-foreground/20">{bot.name.charAt(0).toUpperCase()}</span>
              </div>
              <p className="text-sm font-medium text-foreground truncate">{bot.name}</p>
              <p className="text-xs text-muted truncate">{bot.tagline || "AI character"}</p>
              {bot.is_nsfw && (
                <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-danger/10 text-danger">18+</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedBot && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedBot(null)}
        >
          <div
            className="w-full md:max-w-sm bg-ios-elevated rounded-t-[24px] md:rounded-[24px] p-6 ios-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-4 md:hidden" />
            <div className="w-20 h-20 rounded-[16px] bg-gradient-to-br from-brand/20 to-brand-dark/20 border border-white/10 flex items-center justify-center mb-4 mx-auto">
              <span className="text-3xl font-bold text-brand">{selectedBot.name.charAt(0).toUpperCase()}</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground text-center mb-1">{selectedBot.name}</h3>
            <p className="text-sm text-muted text-center mb-4">{selectedBot.tagline || "AI character"}</p>
            {selectedBot.genres && selectedBot.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center mb-5">
                {selectedBot.genres.slice(0, 4).map((g) => (
                  <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/5 text-muted border border-white/5">
                    {g}
                  </span>
                ))}
              </div>
            )}
            <Link
              href={`/chat/${selectedBot.id}`}
              className="block w-full text-center py-3.5 rounded-full bg-gradient-to-r from-brand to-brand-dark text-white font-medium ios-press"
            >
              Start Chat
            </Link>
            <button
              onClick={() => setSelectedBot(null)}
              className="block w-full text-center py-2.5 mt-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
