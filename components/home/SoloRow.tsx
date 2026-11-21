"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Bot = {
  id: string;
  name: string;
  tagline: string | null;
  is_nsfw: boolean | null;
  genres: string[] | null;
  image_url?: string | null;
};

const PALETTES = [
  ["oklch(0.45 0.18 350)", "oklch(0.3 0.08 300)"],
  ["oklch(0.55 0.14 60)", "oklch(0.3 0.08 20)"],
  ["oklch(0.45 0.12 280)", "oklch(0.25 0.06 300)"],
  ["oklch(0.5 0.16 15)", "oklch(0.28 0.07 330)"],
  ["oklch(0.48 0.1 200)", "oklch(0.26 0.06 260)"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * "While you wait" — a horizontal rail of solo characters. Always SFW on
 * the landing page. Selects `*` so a column that a given environment's
 * schema doesn't have yet (e.g. image_url) can't break the whole query.
 */
export default function SoloRow() {
  const [bots, setBots] = useState<Bot[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await createClient()
          .from("bots")
          .select("*")
          .eq("is_nsfw", false)
          .order("created_at", { ascending: false })
          .limit(12);
        if (!cancelled) setBots((data as Bot[] | null) ?? []);
      } catch {
        if (!cancelled) setBots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (bots === null) {
    return (
      <div className="flex gap-4 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 w-48 shrink-0 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  if (bots.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface/60 p-8 text-center">
        <p className="font-display text-xl text-foreground">The cast is still arriving.</p>
        <p className="mt-2 text-sm text-muted">Be the first — create a character people can meet tonight.</p>
        <Link
          href="/create"
          className="mt-5 inline-flex h-10 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white ios-press"
        >
          Create a character
        </Link>
      </div>
    );
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scrollbar-none sm:-mx-6 sm:px-6">
      {bots.map((b) => {
        const [a, c] = PALETTES[hash(b.name) % PALETTES.length];
        return (
          <Link
            key={b.id}
            href={`/characters/${b.id}`}
            className="group relative h-64 w-48 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-surface ios-press"
          >
            {b.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.image_url}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: `radial-gradient(120% 90% at 30% 20%, ${a}, ${c})` }}
              >
                <span className="font-display text-6xl italic text-white/85">{b.name.charAt(0)}</span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-12">
              <p className="font-display text-lg leading-tight text-white">{b.name}</p>
              {b.tagline && <p className="mt-1 line-clamp-2 text-xs text-white/70">{b.tagline}</p>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
