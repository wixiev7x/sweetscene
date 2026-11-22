"use client";

import { useEffect, useState } from "react";
import { getCharacterDetails, getCharacterPublicCard, type CharacterDetails, type CharacterPublicCard } from "@/lib/actions/character-details";
import HoverCardView from "@/components/hover-card/HoverCardView";
import { resolveCard } from "@/components/hover-card/CardHoverPreview";
import { compact, Flames, FlameDefs, HEART } from "./bits";

/** Right-hand character panel on the chat screen. Collapsible. */
export default function ChatSidePanel({ characterId, onNewChat }: { characterId: string; onNewChat?: () => void }) {
  const [c, setC] = useState<CharacterPublicCard | null>(null);
  const [d, setD] = useState<CharacterDetails | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all([getCharacterPublicCard(characterId), getCharacterDetails(characterId)]).then(([card, det]) => {
      if (!live) return;
      setC(card);
      setD(det);
    });
    return () => {
      live = false;
    };
  }, [characterId]);

  if (!c) return null;
  const card = resolveCard({ name: c.name, age: c.age, story: d?.about || c.short_description, greeting: c.first_message, tags: c.tags, hover_card: c.hover_card }, "custom");

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Show character info"
        className="absolute right-4 top-4 z-20 hidden h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 lg:flex"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="4" /><path d="M15 4v16" /></svg>
      </button>
    );

  return (
    <aside className="relative z-10 hidden w-[380px] shrink-0 flex-col border-l border-white/[.06] bg-black/55 backdrop-blur-2xl lg:flex">
      <FlameDefs />
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
        <div className="group relative aspect-[4/5] w-full overflow-hidden">
          {c.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.avatar_url} alt="" className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-[1200ms] group-hover:scale-105" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Hide character info"
            className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          <div className="absolute inset-x-0 bottom-0 p-5">
            <h2 className="font-display text-3xl leading-tight text-white">
              {c.name}
              {c.age ? <span className="ml-2 text-white/55">{c.age}</span> : null}
            </h2>
            {c.tagline && <p className="mt-1.5 text-[15px] leading-snug text-white/80">{c.tagline}</p>}
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex items-center gap-4 text-sm text-muted-strong">
            <span className="flex items-center gap-1.5"><Flames value={d?.rating ?? 0} size={13} /> {d?.rating ? d.rating.toFixed(1) : "New"}</span>
            <span className="flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={HEART} /></svg>{compact(c.like_count)}</span>
            <span>{compact(c.chat_count)} chats</span>
          </div>
          {d?.creator && <p className="text-sm text-muted">by <span className="text-foreground-dim">@{d.creator}</span></p>}
          {c.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <span key={t} className="rounded-full bg-white/[.07] px-3 py-1 text-xs text-foreground-dim">{t}</span>
              ))}
            </div>
          )}
          {card && <HoverCardView card={card} compact />}
          {onNewChat && (
            <button type="button" onClick={onNewChat} className="h-12 w-full rounded-full bg-white/[.07] text-[15px] text-foreground transition-colors hover:bg-white/[.12]">
              Start a new scene
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
