"use client";

import Link from "next/link";

const CATEGORIES = [
  { name: "Romance", count: 0, color: "text-brand-light" },
  { name: "Mystery", count: 0, color: "text-neon-purple" },
  { name: "Fantasy", count: 0, color: "text-neon-green" },
  { name: "Sci-Fi", count: 0, color: "text-info" },
  { name: "Slice of Life", count: 0, color: "text-gold-400" },
  { name: "Thriller", count: 0, color: "text-crimson-400" },
];

export default function TrendingPage() {
  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 pb-14 md:pb-0">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-light text-foreground-dim mb-2">Trending</h1>
        <p className="text-sm text-muted mb-8">Live activity by interest category.</p>

        <div className="space-y-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.name}
              href={`/explore`}
              className="flex items-center justify-between bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl px-5 py-4 hover:border-neon-magenta/40 transition-all"
            >
              <span className={`text-sm font-medium ${cat.color}`}>{cat.name}</span>
              <span className="text-xs text-muted-faint">{cat.count} active</span>
            </Link>
          ))}
        </div>

        {CATEGORIES.every((c) => c.count === 0) && (
          <div className="text-center mt-8">
            <p className="text-xs text-muted-faint">No trending activity yet.</p>
            <Link href="/create" className="inline-block mt-3 text-xs text-brand-light hover:text-brand-lighter underline-offset-4 hover:underline transition-all">
              Create the first character &rarr;
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
