"use client";

import Link from "next/link";
import { useState } from "react";
import { playSound } from "@/lib/utils/sound";

type Bounty = {
  id: number;
  author: string;
  text: string;
  tags: string[];
  responses: number;
  time: string;
};

const initialBounties: Bounty[] = [
  { id: 1, author: "User_4921", text: "Want a slow-burn scene, someone patient, into indie music. No rush.", tags: ["slow-burn", "indie", "patient"], responses: 3, time: "5m ago" },
  { id: 2, author: "User_7782", text: "Late night diner scene. Need someone who can keep up with weird questions.", tags: ["diner", "late-night", "weird"], responses: 7, time: "12m ago" },
  { id: 3, author: "User_3344", text: "Looking for a mystery partner. Train compartment scenario. 6 hours to kill.", tags: ["mystery", "train", "long-form"], responses: 2, time: "1h ago" },
  { id: 4, author: "User_8890", text: "Rooftop stargazing. Someone quiet. Let the AI do the talking.", tags: ["quiet", "stargazing", "ai-led"], responses: 5, time: "2h ago" },
  { id: 5, author: "User_1247", text: "Masquerade ball scene. Be someone else for a night. No unmasking.", tags: ["masquerade", "anonymous", "no-reveal"], responses: 11, time: "3h ago" },
];

export default function BountiesPage() {
  const [bounties, setBounties] = useState<Bounty[]>(initialBounties);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    playSound("matchFound");
    const newBounty: Bounty = {
      id: Date.now(),
      author: "User_" + Math.floor(1000 + Math.random() * 9000),
      text: text.trim(),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      responses: 0,
      time: "just now",
    };
    setBounties([newBounty, ...bounties]);
    setText("");
    setTags("");
    setShowForm(false);
  };

  const handleRespond = (author: string) => {
    playSound("click");
    alert("Response sent!");
  };

  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">Bounties</h1>
          <p className="text-muted-strong">Looking for something specific? Post a request or respond to one.</p>
        </div>

        <button
          onClick={() => {
            playSound("click");
            setShowForm(!showForm);
          }}
          className="mb-6 px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors border border-brand/30"
        >
          {showForm ? "Cancel" : "Post a Bounty"}
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 p-6 bg-surface-raised rounded-2xl border border-white/10 animate-slide-up">
            <label className="block text-sm text-muted-strong mb-2">What kind of scene are you looking for?</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Want a slow-burn scene, someone patient, into indie music. No rush."
              className="w-full p-4 bg-surface rounded-xl border border-white/10 text-white placeholder:text-muted-faint focus:outline-none focus:border-brand/40 resize-none mb-4"
              rows={4}
            />
            <label className="block text-sm text-muted-strong mb-2">Interest tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="slow-burn, indie, patient"
              className="w-full p-4 bg-surface rounded-xl border border-white/10 text-white placeholder:text-muted-faint focus:outline-none focus:border-brand/40 mb-4"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors border border-brand/30"
            >
              Post Bounty
            </button>
          </form>
        )}

        <div className="space-y-4">
          {bounties.map((bounty) => (
            <div key={bounty.id} className="bg-surface/50 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center text-brand-light font-bold text-sm">
                    {bounty.author.slice(-2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{bounty.author}</p>
                    <p className="text-xs text-muted-faint">{bounty.time}</p>
                  </div>
                </div>
                <span className="text-xs text-muted bg-surface-raised px-3 py-1 rounded-full">
                  {bounty.responses} {bounty.responses === 1 ? "response" : "responses"}
                </span>
              </div>
              <p className="text-foreground-dim mb-4 leading-relaxed">{bounty.text}</p>
              {bounty.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {bounty.tags.map((tag, i) => (
                    <span key={i} className="bg-neon-magenta/10 text-brand-light text-xs rounded-full px-3 py-1">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => handleRespond(bounty.author)}
                className="px-4 py-2 rounded-lg bg-surface-raised border border-white/10 text-sm font-medium text-foreground hover:border-brand/30 hover:text-brand-light transition-all"
              >
                Respond
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
