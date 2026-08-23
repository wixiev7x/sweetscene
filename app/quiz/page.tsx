"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { playSound } from "@/lib/utils/sound";
import { createClient } from "@/lib/supabase/client";

const QUESTIONS = [
  { q: "It's 3am and you can't sleep. What sounds ideal?", options: ["A deep conversation with a stranger", "Reading a book in comfortable silence", "Creating something — writing, drawing, coding", "Watching the city from a rooftop"] },
  { q: "What draws you to a scene?", options: ["The mystery — not knowing what happens next", "The connection — finding someone who gets it", "The story — building something together", "The escape — being someone else for a while"] },
  { q: "When the AI throws a curveball, you...", options: ["Embrace it — that's the fun", "Think carefully before responding", "Match the energy — throw one back", "Go quiet and see what they do"] },
  { q: "After a great scene, you want to...", options: ["Unmask immediately — I need to know", "Stay anonymous — the mystery was the point", "Leave it ambiguous — maybe another scene", "Talk about it on the Confessions wall"] },
  { q: "Your ideal scenario setting?", options: ["Somewhere cozy and enclosed — diner, train, cafe", "Somewhere vast and open — rooftop, field, sea", "Somewhere charged and formal — ball, office, gala", "Somewhere unexpected — anywhere but the obvious"] },
];

type Candidate = {
  id: string;
  name: string;
  tagline: string;
  is_nsfw: boolean;
  genres: string[];
};

const GRADIENTS = [
  "from-brand to-crimson-600",
  "from-neon-purple to-brand",
  "from-crimson-500 to-brand-dark",
  "from-brand-light to-neon-purple",
  "from-crimson-600 to-gold-600",
  "from-neon-purple to-crimson-500",
  "from-brand-dark to-neon-purple",
  "from-gold-500 to-brand",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function QuizPage() {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    if (!showResult) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("bots")
          .select("id, name, tagline, is_nsfw, genres")
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        if (!cancelled && data && data.length > 0) {
          setCandidates(data.map((b: Record<string, unknown>) => ({
            id: b.id as string,
            name: b.name as string,
            tagline: (b.tagline as string) || "",
            is_nsfw: (b.is_nsfw as boolean) ?? false,
            genres: (b.genres as string[]) ?? [],
          })));
        }
      } catch {
        // empty — will show empty state
      }
    })();
    return () => { cancelled = true; };
  }, [showResult]);

  function handleAnswer(idx: number) {
    playSound("click");
    const newAnswers = [...answers, idx];
    setAnswers(newAnswers);
    if (current < QUESTIONS.length - 1) {
      setCurrent(current + 1);
    } else {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setShowResult(true);
        playSound("revealComplete");
      }, 2000);
    }
  }

  function handleBack() {
    if (current > 0) {
      setAnswers(answers.slice(0, -1));
      setCurrent(current - 1);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-void-950 text-white flex items-center justify-center px-6 md:pl-16 pb-14 md:pb-0">
        <div className="text-center">
          <p className="text-lg text-brand-light italic animate-pulse">Finding your matches...</p>
          <p className="text-sm text-muted mt-2">Setting the scene...</p>
        </div>
      </main>
    );
  }

  if (showResult) {
    const seed = answers.reduce((a, b) => a + b, 0);
    const matched = candidates.length > 0
      ? [...candidates].sort((a, b) => hashStr(a.id + seed) - hashStr(b.id + seed)).slice(0, 6)
      : [];

    return (
      <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 md:pl-16 pb-14 md:pb-0">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-sm tracking-[0.3em] text-neon-magenta/60 uppercase font-retro">Your Matches</span>
            <h1 className="text-2xl font-light text-foreground-dim mt-2">People you might match with</h1>
            <p className="text-sm text-muted mt-1">Based on your answers, here are the best candidates for a scene.</p>
          </div>

          {matched.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted text-lg mb-2">No characters available yet</p>
              <p className="text-muted-faint text-sm mb-6">Be the first to create one.</p>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 text-sm px-6 py-3 rounded-md text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all"
              >
                <span className="text-base leading-none">+</span> Create a Character
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {matched.map((c) => {
                const grad = GRADIENTS[hashStr(c.name) % GRADIENTS.length];
                const tags = (c.genres || []).slice(0, 2);
                return (
                  <Link
                    key={c.id}
                    href={`/chat/${c.id}`}
                    onClick={() => playSound("click")}
                    className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-neon-magenta/40 hover:scale-[1.02] transition-all duration-200"
                  >
                    <div className="aspect-[3/4] relative overflow-hidden">
                      <div className={`absolute inset-0 bg-gradient-to-br ${grad} flex items-center justify-center`}>
                        <span className="text-5xl font-bold text-white/30">{c.name[0] || "?"}</span>
                      </div>
                      {c.is_nsfw && (
                        <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-md bg-crimson-500/80 text-white font-bold">
                          18+
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-base text-foreground group-hover:text-neon-magenta transition-colors truncate font-medium">
                        {c.name}
                      </h3>
                      {c.tagline && (
                        <p className="text-xs text-muted truncate mt-1">{c.tagline}</p>
                      )}
                      {tags.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          {tags.map((t) => (
                            <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-neon-magenta/10 text-brand-light">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => { setAnswers([]); setCurrent(0); setShowResult(false); playSound("click"); }}
              className="text-sm px-6 py-3 rounded-md text-muted bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              Retake Quiz
            </button>
            <Link
              href="/explore"
              className="text-sm px-6 py-3 rounded-md text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all text-center"
            >
              Browse All Characters
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const progress = ((current + 1) / QUESTIONS.length) * 100;

  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 flex items-center justify-center md:pl-16 pb-14 md:pb-0">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-light text-foreground-dim">Matchmaker</h1>
          <p className="text-sm text-muted mt-1">5 quick questions. Find your best matches.</p>
        </div>
        <div className="w-full bg-surface/30 rounded-full h-1 mb-8">
          <div className="bg-gradient-to-r from-brand to-crimson-500 h-1 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div key={current} className="animate-slide-up">
          <p className="text-xs text-muted-faint mb-4">Question {current + 1} of {QUESTIONS.length}</p>
          <h2 className="text-lg text-foreground mb-6">{QUESTIONS[current].q}</h2>
          <div className="space-y-3">
            {QUESTIONS[current].options.map((opt, i) => (
              <button key={i} onClick={() => handleAnswer(i)}
                className="w-full text-left bg-surface/50 border border-white/10 rounded-xl p-4 hover:border-brand/30 hover:bg-surface-raised transition-all">
                <span className="text-sm text-foreground-dim">{opt}</span>
              </button>
            ))}
          </div>
          {current > 0 && (
            <button onClick={handleBack} className="text-xs text-muted hover:text-foreground-dim mt-6 underline-offset-4 hover:underline">
              ← Back
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
