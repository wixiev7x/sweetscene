"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface BotCard {
  id: string;
  name: string;
  tagline: string | null;
  is_nsfw: boolean | null;
}

export function SuggestedBots({ kinkTags }: { kinkTags: string[] }) {
  const [bots, setBots] = useState<BotCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("bots")
          .select("id, name, tagline, is_nsfw")
          .limit(3);
        if (!cancelled && data) {
          const shuffled = (data as BotCard[]).sort(() => Math.random() - 0.5).slice(0, 3);
          setBots(shuffled);
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kinkTags]);

  if (loading) {
    return (
      <div className="px-4 pb-8 pt-2">
        <p className="text-sm font-semibold text-foreground mb-1">Finding match... chat solo while you wait</p>
        <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-36">
              <div className="aspect-[3/4] rounded-[16px] bg-foreground/5 animate-pulse" />
              <div className="h-3 bg-foreground/5 rounded animate-pulse mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (bots.length === 0) return null;

  return (
    <div className="px-4 pb-8 pt-2">
      <p className="text-sm font-semibold text-foreground mb-1">Finding match... chat solo while you wait</p>
      <p className="text-xs text-muted mb-3">Opens in new tab</p>
      <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-2">
        {bots.map((bot) => (
          <a
            key={bot.id}
            href={`/chat/${bot.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="snap-start flex-shrink-0 w-36 text-left ios-press"
          >
            <div className="aspect-[3/4] rounded-[16px] bg-gradient-to-br from-foreground/10 to-foreground/5 border border-white/10 flex items-center justify-center mb-2 overflow-hidden">
              <span className="text-3xl font-bold text-foreground/20">{bot.name.charAt(0).toUpperCase()}</span>
            </div>
            <p className="text-sm font-medium text-foreground truncate">{bot.name}</p>
            <p className="text-xs text-muted truncate">{bot.tagline || "AI character"}</p>
            {bot.is_nsfw && (
              <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-danger/10 text-danger">18+</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
