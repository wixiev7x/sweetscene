"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { playSound } from "@/lib/utils/sound";
import { createClient } from "@/lib/supabase/client";

const GENRES = ["Romance", "Mystery", "Fantasy", "Sci-Fi", "Slice of Life", "Thriller"];
const STYLES = ["Casual", "Formal", "Poetic", "Dark", "Playful", "Mysterious"];

export default function CreatePage() {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [personality, setPersonality] = useState("");
  const [openingLine, setOpeningLine] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [isNsfw, setIsNsfw] = useState(false);
  const [published, setPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function toggle(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
    playSound("click");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("bots").insert({
        name: name.trim(),
        tagline: tagline.trim(),
        personality: personality.trim(),
        opening_line: openingLine.trim(),
        is_nsfw: isNsfw,
        genres,
        styles,
      });

      if (error) throw error;

      playSound("matchFound");
      toast.success("Character published successfully!");
      setPublished(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish character";
      toast.error(message);
      playSound("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (published) {
    return (
      <main className="min-h-screen bg-void-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4 text-neon-green">&#x2713;</div>
          <h1 className="text-2xl font-light text-foreground mb-3">Character published!</h1>
          <p className="text-sm text-muted mb-8">It will appear in Explore once approved.</p>
          <Link href="/explore" className="px-8 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 active:scale-95 transform transition-all inline-block">
            View in Explore →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-light text-foreground-dim mb-2">Create a Character</h1>
        <p className="text-sm text-muted mb-6">Design an AI personality for others to interact with.</p>

        <div className="bg-gold-500/5 border border-gold-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-gold-400">You need an account to create AI characters.</p>
          <Link href="/login" className="text-xs text-gold-400 underline">Login →</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand to-crimson-600 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
              {name[0] || "?"}
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-faint uppercase tracking-wider">Character Avatar</label>
              <p className="text-xs text-muted mt-1">Auto-generated from name</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-faint uppercase tracking-wider mb-2 block">Character Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="A short, intriguing name..." required
              className="w-full bg-surface/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:ring-2 focus:ring-neon-magenta/50" />
          </div>

          <div>
            <label className="text-xs text-muted-faint uppercase tracking-wider mb-2 block">Tagline</label>
            <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="A short, intriguing description..." required
              className="w-full bg-surface/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:ring-2 focus:ring-neon-magenta/50" />
          </div>

          <div>
            <label className="text-xs text-muted-faint uppercase tracking-wider mb-2 block">Personality Description</label>
            <textarea value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="Describe how this character thinks, speaks, and behaves." required rows={4}
              className="w-full bg-surface/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:ring-2 focus:ring-neon-magenta/50 resize-none" />
          </div>

          <div>
            <label className="text-xs text-muted-faint uppercase tracking-wider mb-2 block">Opening Line</label>
            <textarea value={openingLine} onChange={(e) => setOpeningLine(e.target.value)} placeholder="What does this character say first? Set the scene..." required rows={3}
              className="w-full bg-surface/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:ring-2 focus:ring-neon-magenta/50 resize-none" />
          </div>

          <div>
            <label className="text-xs text-muted-faint uppercase tracking-wider mb-2 block">Genres</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button key={g} type="button" onClick={() => toggle(genres, setGenres, g)}
                  className={`px-4 py-1.5 rounded-full text-sm border transition-all ${genres.includes(g) ? "bg-brand/20 border-brand/40 text-brand-light" : "bg-surface/30 border-white/10 text-muted hover:text-foreground-dim"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-faint uppercase tracking-wider mb-2 block">Styles</label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button key={s} type="button" onClick={() => toggle(styles, setStyles, s)}
                  className={`px-4 py-1.5 rounded-full text-sm border transition-all ${styles.includes(s) ? "bg-brand/20 border-brand/40 text-brand-light" : "bg-surface/30 border-white/10 text-muted hover:text-foreground-dim"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isNsfw} onChange={(e) => setIsNsfw(e.target.checked)} className="accent-crimson-500" />
            <span className="text-sm text-muted-strong">This character contains adult content (18+)</span>
          </label>

          <button type="submit" disabled={!name || !tagline || !personality || !openingLine || submitting}
            className="w-full px-6 py-3.5 rounded-xl font-medium text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 active:scale-95 transform transition-all disabled:opacity-50 disabled:cursor-not-allowed pulse-glow flex items-center justify-center gap-2">
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Publishing...
              </>
            ) : (
              "Publish Character"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
