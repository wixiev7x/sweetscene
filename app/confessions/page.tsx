"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { playSound } from "@/lib/utils/sound";
import { createClient } from "@/lib/supabase/client";

type Mood = "Heartwarming" | "Funny" | "Awkward" | "Spicy" | "Melancholic";

type Confession = {
  id: string;
  text: string;
  mood: Mood;
  time: string;
  likes: number;
};

const moods: Mood[] = ["Heartwarming", "Funny", "Awkward", "Spicy", "Melancholic"];

const moodStyles: Record<Mood, string> = {
  Heartwarming: "bg-neon-green/10 text-neon-green border-neon-green/30",
  Funny: "bg-gold-500/10 text-gold-400 border-gold-500/30",
  Awkward: "bg-brand/10 text-brand-light border-brand/30",
  Spicy: "bg-crimson-500/10 text-crimson-500 border-crimson-500/30",
  Melancholic: "bg-brand/10 text-brand-lighter border-brand/30",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ConfessionsPage() {
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const charCount = text.length;
  const maxChars = 500;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("confessions")
          .select("id, text, mood, likes, created_at")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        if (!cancelled && data) {
          setConfessions(
            data.map((c: Record<string, unknown>) => ({
              id: c.id as string,
              text: c.text as string,
              mood: (c.mood as Mood) || "Heartwarming",
              likes: (c.likes as number) ?? 0,
              time: timeAgo(c.created_at as string),
            }))
          );
        }
      } catch {
        // show empty state on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !selectedMood || submitting) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("confessions")
        .insert({
          text: text.trim(),
          mood: selectedMood,
          likes: 0,
        })
        .select("id, text, mood, likes, created_at")
        .single();

      if (error) throw error;

      playSound("matchFound");
      toast.success("Story posted anonymously!");

      const newConfession: Confession = {
        id: (data as Record<string, unknown>).id as string,
        text: (data as Record<string, unknown>).text as string,
        mood: ((data as Record<string, unknown>).mood as Mood) || selectedMood,
        likes: 0,
        time: "just now",
      };
      setConfessions([newConfession, ...confessions]);
      setText("");
      setSelectedMood(null);
      setShowForm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to post story";
      toast.error(message);
      playSound("error");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleLike(id: string) {
    playSound("message");
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function getLikes(confession: Confession) {
    const liked = likedIds.has(confession.id);
    return liked ? confession.likes + 1 : confession.likes;
  }

  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">Anonymous Stories</h1>
          <p className="text-muted-strong">Confess. Share. Anonymize.</p>
        </div>

        <button
          onClick={() => {
            playSound("click");
            setShowForm(!showForm);
          }}
          className="mb-6 px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors border border-brand/30"
        >
          {showForm ? "Cancel" : "Submit Anonymous Story"}
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 p-6 bg-surface-raised rounded-2xl border border-white/10 animate-slide-up">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, maxChars))}
              placeholder="Share your story anonymously..."
              className="w-full p-4 bg-surface rounded-xl border border-white/10 text-white placeholder:text-muted-faint focus:outline-none focus:border-brand/40 resize-none mb-2"
              rows={4}
              required
            />
            <div className="text-right text-xs text-muted-faint mb-4">
              {charCount} / {maxChars}
            </div>
            <label className="block text-sm text-muted-strong mb-2">Mood</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {moods.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => {
                    playSound("click");
                    setSelectedMood(selectedMood === mood ? null : mood);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                    selectedMood === mood
                      ? moodStyles[mood]
                      : "bg-surface border-white/10 text-muted hover:border-white/20"
                  }`}
                >
                  {mood}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={!text.trim() || !selectedMood || submitting}
              className="px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors border border-brand/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Posting...
                </>
              ) : (
                "Post Anonymously"
              )}
            </button>
          </form>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface/30 border border-white/5 rounded-2xl p-6 animate-pulse">
                <div className="h-4 bg-surface-raised rounded w-full mb-2" />
                <div className="h-4 bg-surface-raised rounded w-3/4 mb-4" />
                <div className="h-6 bg-surface-raised rounded-full w-24" />
              </div>
            ))}
          </div>
        ) : confessions.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted text-lg mb-2">No stories yet</p>
            <p className="text-muted-faint text-sm">Be the first to share one!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {confessions.map((confession) => {
              const liked = likedIds.has(confession.id);
              return (
                <div key={confession.id} className="bg-surface/30 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
                  <p className="text-foreground-dim leading-relaxed mb-4">{confession.text}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${moodStyles[confession.mood]}`}>
                        {confession.mood}
                      </span>
                      <span className="text-xs text-muted-faint">{confession.time}</span>
                    </div>
                    <button
                      onClick={() => toggleLike(confession.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                        liked
                          ? "bg-crimson-500/10 border-crimson-500/30 text-crimson-500"
                          : "bg-surface-raised border-white/10 text-muted hover:border-white/20"
                      }`}
                    >
                      <span className={liked ? "scale-110" : ""}>♥</span>
                      <span className="text-sm font-medium">{getLikes(confession)}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
