"use client";

import Link from "next/link";
import { useState } from "react";
import { playSound } from "@/lib/utils/sound";

type Mood = "Heartwarming" | "Funny" | "Awkward" | "Spicy" | "Melancholic";

type Confession = {
  id: number;
  text: string;
  mood: Mood;
  time: string;
  likes: number;
};

const initialConfessions: Confession[] = [
  { id: 1, text: "We talked till 4am in the Train Compartment scene. Never revealed. Never will. But I think about them.", mood: "Heartwarming", time: "2h ago", likes: 342 },
  { id: 2, text: "The AI asked us what we'd save from a burning house. They said 'my cat.' I said 'the letter my mom never sent.' We didn't speak for 10 minutes after that.", mood: "Melancholic", time: "5h ago", likes: 891 },
  { id: 3, text: "Matched with someone in the Diner scene. They ordered for me. It was exactly what I wanted. I still don't know how.", mood: "Funny", time: "8h ago", likes: 567 },
  { id: 4, text: "We did the Masquerade Ball. I was a duchess. They were a thief. The AI made us dance. I haven't felt that alive in years.", mood: "Spicy", time: "12h ago", likes: 1203 },
  { id: 5, text: "Awkward moment: the AI asked us to describe our ideal first date. We both described the same cafe. We lived 3000 miles apart.", mood: "Awkward", time: "1d ago", likes: 745 },
  { id: 6, text: "I matched with someone who turned out to be my actual neighbor. We never unmasked. We still nod at each other in the hallway.", mood: "Funny", time: "2d ago", likes: 2104 },
];

const moods: Mood[] = ["Heartwarming", "Funny", "Awkward", "Spicy", "Melancholic"];

const moodStyles: Record<Mood, string> = {
  Heartwarming: "bg-neon-green/10 text-neon-green border-neon-green/30",
  Funny: "bg-gold-500/10 text-gold-400 border-gold-500/30",
  Awkward: "bg-brand/10 text-brand-light border-brand/30",
  Spicy: "bg-crimson-500/10 text-crimson-500 border-crimson-500/30",
  Melancholic: "bg-brand/10 text-brand-lighter border-brand/30",
};

export default function ConfessionsPage() {
  const [confessions, setConfessions] = useState<Confession[]>(initialConfessions);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());

  const charCount = text.length;
  const maxChars = 500;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !selectedMood) return;
    playSound("matchFound");
    const newConfession: Confession = {
      id: Date.now(),
      text: text.trim(),
      mood: selectedMood,
      time: "just now",
      likes: 0,
    };
    setConfessions([newConfession, ...confessions]);
    setText("");
    setSelectedMood(null);
    setShowForm(false);
  };

  const toggleLike = (id: number) => {
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
  };

  const getLikes = (confession: Confession) => {
    const liked = likedIds.has(confession.id);
    return liked ? confession.likes + 1 : confession.likes;
  };

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
              disabled={!text.trim() || !selectedMood}
              className="px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors border border-brand/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Post Anonymously
            </button>
          </form>
        )}

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
      </div>
    </main>
  );
}
