"use client";

import Link from "next/link";

/* Browse-by-genre — every lane links straight into Explore. No live
 * counts are shown: when there's real activity data, this page earns
 * numbers. Until then it stays an honest directory. */
const CATEGORIES = [
  { name: "Romance", color: "text-brand-light" },
  { name: "Mystery", color: "text-accent-rose" },
  { name: "Fantasy", color: "text-success" },
  { name: "Sci-Fi", color: "text-info" },
  { name: "Slice of Life", color: "text-gold-400" },
  { name: "Thriller", color: "text-crimson-400" },
];

export default function TrendingPage() {
  return (
    <div className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="type-display text-2xl md:text-3xl mb-2 text-foreground">Fresh from the scene</h1>
        <p className="type-body text-muted mb-8">Browse by genre — the shelf is newest first inside each lane.</p>

        <div className="space-y-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.name}
              href="/explore"
              className="flex items-center justify-between bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl px-5 py-4 hover:border-accent-candle/40 transition-all focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <span className={`type-body font-medium ${cat.color}`}>{cat.name}</span>
              <span className="type-meta text-muted-faint">Browse hosts →</span>
            </Link>
          ))}
        </div>

        <div className="text-center mt-10">
          <p className="type-meta text-muted-faint mb-3">
            Live activity feeds land here once the scene is busy enough to have one.
          </p>
          <Link
            href="/create"
            className="inline-block type-meta text-brand-light hover:text-brand-lighter underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-line-focus rounded px-1"
          >
            Create a character &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
