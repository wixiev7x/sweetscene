"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { playSound } from "@/lib/utils/sound";

type Mood = "Heartwarming" | "Funny" | "Awkward" | "Spicy" | "Melancholic";

type Confession = {
  id: string;
  text: string;
  mood: Mood;
  likes: number;
  created_at: string;
};

const MOODS: Mood[] = ["Heartwarming", "Funny", "Awkward", "Spicy", "Melancholic"];

const moodStyles: Record<Mood, string> = {
  Heartwarming: "bg-accent-candle/10 text-accent-candle border-accent-candle/30",
  Funny: "bg-gold-400/10 text-gold-400 border-gold-400/30",
  Awkward: "bg-accent-rose/10 text-accent-rose border-accent-rose/30",
  Spicy: "bg-crimson-500/10 text-crimson-400 border-crimson-500/30",
  Melancholic: "bg-info/10 text-info border-info/30",
};

const MAX_CHARS = 500;

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function CandleMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" className="opacity-70">
      <defs>
        <radialGradient id="candleGlow" cx="0.5" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="oklch(0.82 0.14 75 / 0.5)" />
          <stop offset="100%" stopColor="oklch(0.82 0.14 75 / 0)" />
        </radialGradient>
      </defs>
      <circle cx="18" cy="12" r="10" fill="url(#candleGlow)" />
      <path d="M18 8 C16 11 16 13 18 14.5 C20 13 20 11 18 8 Z" fill="oklch(0.82 0.14 75)" />
      <rect x="15.5" y="15" width="5" height="14" rx="1.5" fill="oklch(0.33 0.04 285)" />
      <line x1="18" y1="13" x2="18" y2="15" stroke="oklch(0.95 0.01 60 / 0.6)" strokeWidth="0.8" />
    </svg>
  );
}

export default function ConfessionsPage() {
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("confessions")
          .select("id, text, mood, likes, created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (!cancelled && data) setConfessions(data as Confession[]);
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleLike = (id: string) => {
    playSound("message");
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getLikes = (c: Confession) => c.likes + (likedIds.has(c.id) ? 1 : 0);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("confessions")
        .insert({ text: trimmed, mood: selectedMood ?? "Heartwarming", likes: 0 })
        .select("id, text, mood, likes, created_at")
        .single();
      if (error || !data) {
        toast.error("Could not post your story — try again");
        return;
      }
      playSound("matchFound");
      toast.success("Posted anonymously");
      setConfessions((prev) => [data as Confession, ...prev]);
      setText("");
      setSelectedMood(null);
      setShowForm(false);
    } catch {
      toast.error("Could not post your story — try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-4 sm:px-6 py-8 pb-14 md:pb-0">
      <div className="max-w-2xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent-candle mb-2">
          After hours
        </p>
        <h1 className="font-retro text-3xl sm:text-4xl leading-tight mb-3">
          Confessions from the <span className="gradient-text">dark.</span>
        </h1>
        <p className="text-sm text-muted mb-8">
          Anonymous stories from the scene. No names, no faces.
        </p>

        <button
          onClick={() => {
            playSound("click");
            setShowForm((v) => !v);
          }}
          className="mb-6 px-6 h-11 rounded-full bg-surface-sunken border border-line text-foreground text-sm font-medium hover:border-accent-candle/40 hover:text-accent-candle active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {showForm ? "Close" : "Share a story"}
        </button>

        {showForm && (
          <div className="mb-8 bg-surface border border-line rounded-[var(--radius-card)] p-6 animate-slide-up">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_CHARS}
              rows={4}
              placeholder="What happened in the scene stays in the scene — until now..."
              className="w-full bg-surface-sunken border border-line rounded-[var(--radius-control)] px-4 py-3 text-sm text-foreground placeholder:text-muted-faint focus:outline-none focus:ring-2 focus:ring-line-focus focus:border-accent-candle/40 resize-none transition-all"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="font-mono text-[11px] text-muted-faint uppercase tracking-wider">Mood</p>
              <span className={`font-mono text-[11px] ${text.length >= MAX_CHARS ? "text-danger" : "text-muted-faint"}`}>
                {text.length}/{MAX_CHARS}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMood(selectedMood === m ? null : m)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                    selectedMood === m
                      ? moodStyles[m]
                      : "bg-surface-sunken border-line text-muted hover:border-line-strong hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || text.trim().length === 0}
              className="mt-4 w-full h-11 rounded-full bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-light text-accent-foreground text-sm font-semibold active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-40 disabled:hover:from-brand-dark disabled:hover:to-brand flex items-center justify-center gap-2"
            >
              {submitting && (
                <span className="w-4 h-4 rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground animate-spin" />
              )}
              {submitting ? "Posting..." : "Post Anonymously"}
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-raised/40 border border-line rounded-[var(--radius-card)] p-5 animate-pulse">
                <div className="h-3 w-20 rounded bg-surface-raised mb-3" />
                <div className="h-4 w-full rounded bg-surface-raised mb-2" />
                <div className="h-4 w-2/3 rounded bg-surface-raised" />
              </div>
            ))}
          </div>
        ) : confessions.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <CandleMark />
            <p className="font-retro text-lg mt-4 mb-1">No stories yet</p>
            <p className="text-sm text-muted">Be the first to share one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {confessions.map((c) => {
              const liked = likedIds.has(c.id);
              return (
                <article
                  key={c.id}
                  className="bg-surface border border-line rounded-[var(--radius-card)] p-5 hover:border-line-strong transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] border font-mono ${moodStyles[c.mood] ?? moodStyles.Heartwarming}`}>
                      {c.mood}
                    </span>
                    <span className="font-mono text-[11px] text-muted-faint">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">{c.text}</p>
                  <button
                    onClick={() => toggleLike(c.id)}
                    aria-pressed={liked}
                    className={`mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                      liked
                        ? "bg-accent-rose/10 border-accent-rose/30 text-accent-rose"
                        : "bg-surface-raised border-line text-muted hover:border-accent-rose/30 hover:text-accent-rose"
                    }`}
                  >
                    <span className={liked ? "scale-110" : ""}>&hearts;</span>
                    <span className="font-mono">{getLikes(c)}</span>
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
