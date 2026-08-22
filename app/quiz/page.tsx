"use client";

import Link from "next/link";
import { useState } from "react";
import { playSound } from "@/lib/utils/sound";

const QUESTIONS = [
  { q: "It's 3am and you can't sleep. What sounds ideal?", options: ["A deep conversation with a stranger", "Reading a book in comfortable silence", "Creating something — writing, drawing, coding", "Watching the city from a rooftop"] },
  { q: "What draws you to a scene?", options: ["The mystery — not knowing what happens next", "The connection — finding someone who gets it", "The story — building something together", "The escape — being someone else for a while"] },
  { q: "When the AI throws a curveball, you...", options: ["Embrace it — that's the fun", "Think carefully before responding", "Match the energy — throw one back", "Go quiet and see what they do"] },
  { q: "After a great scene, you want to...", options: ["Unmask immediately — I need to know", "Stay anonymous — the mystery was the point", "Leave it ambiguous — maybe another scene", "Talk about it on the Confessions wall"] },
  { q: "Your ideal scenario setting?", options: ["Somewhere cozy and enclosed — diner, train, cafe", "Somewhere vast and open — rooftop, field, sea", "Somewhere charged and formal — ball, office, gala", "Somewhere unexpected — anywhere but the obvious"] },
];

const PROFILES = [
  { name: "The Deep Diver", tags: ["intense", "thoughtful", "patient"], desc: "You crave substance over surface. Your best scenes are the ones that go deep fast." },
  { name: "The Story Weaver", tags: ["creative", "collaborative", "expressive"], desc: "You're here to build something. Every scene is a chapter waiting to be written." },
  { name: "The Mystery Seeker", tags: ["enigmatic", "curious", "bold"], desc: "You thrive on the unknown. The less you know, the more alive you feel." },
  { name: "The Quiet Storm", tags: ["observant", "intense", "selective"], desc: "You don't say much, but when you do, it lands. Your silence is a weapon." },
];

export default function QuizPage() {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chemistryScore] = useState(67 + Math.floor(Math.random() * 31));

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
      <main className="min-h-screen bg-void-950 text-white flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-lg text-brand-light italic animate-pulse">Calibrating compatibility…</p>
          <p className="text-sm text-muted mt-2">Setting the scene…</p>
        </div>
      </main>
    );
  }

  if (showResult) {
    const profile = PROFILES[answers[0] % PROFILES.length];
    return (
      <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 flex items-center justify-center">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <span className="text-xs tracking-[0.3em] text-neon-magenta/60 uppercase font-retro">Connection Profile</span>
          </div>
          <div className="bg-surface/50 border border-brand/30 rounded-3xl p-8 text-center pulse-glow">
            <h2 className="text-3xl font-light gradient-text mb-4">{profile.name}</h2>
            <p className="text-sm text-muted-strong leading-relaxed mb-6">{profile.desc}</p>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {profile.tags.map((tag) => (
                <span key={tag} className="bg-neon-magenta/10 text-brand-light text-xs rounded-full px-3 py-1">{tag}</span>
              ))}
            </div>
            <div className="border-t border-white/10 pt-6">
              <p className="text-xs text-muted-faint mb-1">Chemistry Score</p>
              <p className="text-4xl text-neon-green font-retro">{chemistryScore}%</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link href="/scenarios" onClick={() => playSound("matchSearch")}
              className="px-8 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 active:scale-95 transform transition-all text-center">
              Find Your Match →
            </Link>
            <Link href="/explore" className="px-8 py-3 rounded-xl font-medium text-muted bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transform transition-all text-center">
              Explore Characters
            </Link>
          </div>
          <p className="text-xs text-muted-faint text-center mt-8">Full quiz experience coming soon.</p>
        </div>
      </main>
    );
  }

  const progress = ((current + 1) / QUESTIONS.length) * 100;

  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 flex items-center justify-center">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-light text-foreground-dim">Connection Quiz</h1>
          <p className="text-sm text-muted mt-1">5 quick questions. Get your Connection Profile.</p>
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
