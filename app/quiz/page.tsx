"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { playSound } from "@/lib/utils/sound";
import { createClient } from "@/lib/supabase/client";

/* Each answer maps to a real vibe tag — the quiz derives a mood
 * profile from your answers and carries it into By Vibe. No fake
 * matching, no invented delays. */
const QUESTIONS = [
  {
    q: "It's 3am and you can't sleep. What sounds ideal?",
    options: ["A deep conversation with a stranger", "Reading a book in comfortable silence", "Creating something — writing, drawing, coding", "Watching the city from a rooftop"],
    vibes: ["Romance", "Slice of Life", "Drama", "Adventure"],
  },
  {
    q: "What draws you to a scene?",
    options: ["The mystery — not knowing what happens next", "The connection — finding someone who gets it", "The story — building something together", "The escape — being someone else for a while"],
    vibes: ["Mystery", "Romance", "Drama", "Fantasy"],
  },
  {
    q: "When the AI throws a curveball, you...",
    options: ["Embrace it — that's the fun", "Think carefully before responding", "Match the energy — throw one back", "Go quiet and see what they do"],
    vibes: ["Comedy", "Thriller", "Comedy", "Mystery"],
  },
  {
    q: "After a great scene, you want to...",
    options: ["Unmask immediately — I need to know", "Stay anonymous — the mystery was the point", "Leave it ambiguous — maybe another scene", "Talk about it on the Confessions wall"],
    vibes: ["Romance", "Mystery", "Slice of Life", "Drama"],
  },
  {
    q: "Your ideal scenario setting?",
    options: ["Somewhere cozy and enclosed — diner, train, cafe", "Somewhere vast and open — rooftop, field, sea", "Somewhere charged and formal — ball, office, gala", "Somewhere unexpected — anywhere but the obvious"],
    vibes: ["Slice of Life", "Romance", "Historical", "Adventure"],
  },
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
  "from-accent-rose to-brand",
  "from-crimson-500 to-brand-dark",
  "from-brand-light to-accent-rose",
  "from-crimson-600 to-gold-600",
  "from-brand to-crimson-500",
  "from-brand-dark to-accent-rose",
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
  const [fetching, setFetching] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  /* Mood profile: the vibe tags your answers actually point at,
   * most-picked first, capped at three. */
  const moodTags = (() => {
    const counts = new Map<string, number>();
    answers.forEach((a, i) => {
      const tag = QUESTIONS[i]?.vibes[a];
      if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 3);
  })();
  const matchmakeHref = `/matchmake?mode=kink${moodTags.length > 0 ? `&tags=${encodeURIComponent(moodTags.join(","))}` : ""}`;

  useEffect(() => {
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
        if (!cancelled && data) {
          setCandidates(data.map((b: Record<string, unknown>) => ({
            id: b.id as string,
            name: b.name as string,
            tagline: (b.tagline as string) || "",
            is_nsfw: (b.is_nsfw as boolean) ?? false,
            genres: (b.genres as string[]) ?? [],
          })));
        }
      } catch {
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function handleAnswer(idx: number) {
    playSound("click");
    const newAnswers = [...answers, idx];
    setAnswers(newAnswers);
    if (current < QUESTIONS.length - 1) {
      setCurrent(current + 1);
    } else {
      setShowResult(true);
      playSound("revealComplete");
    }
  }

  function handleBack() {
    if (current > 0) {
      setAnswers(answers.slice(0, -1));
      setCurrent(current - 1);
    }
  }

  if (showResult) {
    /* Hosts that genuinely fit the derived mood: their genres overlap
     * the tags your answers pointed at. */
    const fitting = candidates.filter((c) => !c.is_nsfw || true);
    const matched = moodTags.length > 0
      ? fitting.filter((c) => (c.genres ?? []).some((g) => moodTags.includes(g)))
      : fitting;
    const shown = matched.slice(0, 6);

    return (
      <div className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <span className="type-eyebrow text-accent-candle">Your mood profile</span>
            <h1 className="type-display text-2xl md:text-3xl mt-3 text-foreground">
              The vibes you&rsquo;re <span className="gradient-text">in the mood for.</span>
            </h1>
            {moodTags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {moodTags.map((t) => (
                  <span key={t} className="type-meta px-3 py-1 rounded-full border border-accent-rose/30 bg-accent-rose/10 text-accent-rose">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <p className="type-body text-muted mt-4 max-w-md mx-auto">
              Taken straight from your answers. Carry them into matchmaking, or start a solo scene with a host who fits.
            </p>
            <Link
              href={matchmakeHref}
              data-cursor="primary"
              className="mt-6 inline-flex h-12 items-center rounded-full bg-gradient-to-r from-brand to-brand-dark px-7 text-sm font-semibold text-accent-foreground ios-press shadow-lg shadow-brand/20 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
            >
              Find a match with these vibes →
            </Link>
          </div>

          {fetching ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <div className="aspect-[3/4] bg-surface-raised animate-pulse" />
                  <div className="p-3">
                    <div className="h-4 w-2/3 bg-surface-raised rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : shown.length > 0 ? (
            <>
              <p className="type-eyebrow text-muted mb-3 text-center">Hosts that fit this mood</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {shown.map((c) => {
                  const grad = GRADIENTS[hashStr(c.name) % GRADIENTS.length];
                  const tags = (c.genres || []).slice(0, 2);
                  return (
                    <Link
                      key={c.id}
                      href={`/play/${c.id}`}
                      onClick={() => playSound("click")}
                      aria-label={`Start a solo scene with ${c.name}`}
                      className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-accent-candle/40 hover:scale-[1.02] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-line-focus"
                    >
                      <div className="aspect-[3/4] relative overflow-hidden">
                        <div className={`absolute inset-0 bg-gradient-to-br ${grad} flex items-center justify-center`}>
                          <span className="text-5xl font-bold text-white/30 font-display">{c.name[0] || "?"}</span>
                        </div>
                        {c.is_nsfw && (
                          <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-md bg-crimson-500/80 text-white font-bold">
                            18+
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="text-base text-foreground group-hover:text-accent-candle transition-colors truncate font-medium">
                          {c.name}
                        </h3>
                        {c.tagline && (
                          <p className="text-xs text-muted truncate mt-1">{c.tagline}</p>
                        )}
                        {tags.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2">
                            {tags.map((t) => (
                              <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-brand/10 text-brand-light">
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
            </>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => { setAnswers([]); setCurrent(0); setShowResult(false); playSound("click"); }}
              className="type-body px-6 py-3 rounded-md text-muted bg-white/5 border border-white/10 hover:bg-white/10 transition-all focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              Retake Quiz
            </button>
            <Link
              href="/explore"
              className="type-body px-6 py-3 rounded-md text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 transition-all text-center focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              Browse All Characters
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const progress = ((current + 1) / QUESTIONS.length) * 100;

  return (
    <div className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 flex items-center justify-center">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="type-display text-2xl text-foreground">Matchmaker</h1>
          <p className="type-body text-muted mt-1">5 quick questions. Your answers set your vibes.</p>
        </div>
        <div className="w-full bg-surface/30 rounded-full h-1 mb-8">
          <div className="bg-gradient-to-r from-brand to-crimson-500 h-1 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div key={current} className="animate-slide-up">
          <p className="type-eyebrow text-muted-faint mb-4">Question {current + 1} of {QUESTIONS.length}</p>
          <h2 className="text-lg text-foreground mb-6">{QUESTIONS[current].q}</h2>
          <div className="space-y-3">
            {QUESTIONS[current].options.map((opt, i) => (
              <button key={i} onClick={() => handleAnswer(i)}
                className="w-full text-left bg-surface/50 border border-white/10 rounded-xl p-4 hover:border-brand/30 hover:bg-surface-raised transition-all focus-visible:ring-2 focus-visible:ring-line-focus">
                <span className="type-body text-foreground-dim">{opt}</span>
              </button>
            ))}
          </div>
          {current > 0 && (
            <button onClick={handleBack} className="type-meta text-muted hover:text-foreground-dim mt-6 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-line-focus rounded px-1">
              ← Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
