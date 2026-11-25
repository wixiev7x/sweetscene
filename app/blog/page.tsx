import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { listPosts } from "@/lib/blog";

export const metadata: Metadata = pageMeta({
  title: "Blog: AI Roleplay, Characters & Anonymous Matchmaking",
  description: "Guides to AI roleplay, creating AI characters, anonymous matchmaking and interactive storytelling.",
  path: "/blog",
});

export default async function BlogIndex() {
  const posts = await listPosts();
  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-8 text-foreground sm:px-6 md:pt-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-4xl md:text-5xl">The SweetScene blog</h1>
        <p className="mt-3 max-w-xl text-[17px] text-muted-strong">Guides to AI roleplay, building unforgettable characters, and meeting strangers through stories.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {posts.map((p, i) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className={`group rounded-[1.75rem] p-6 ring-1 ring-white/[.07] transition-colors hover:ring-brand/40 ${i === 0 ? "sm:col-span-2" : ""}`}
              style={{ background: `radial-gradient(100% 120% at 0% 100%, rgba(225,36,92,${i === 0 ? 0.3 : 0.14}), transparent 60%), #0c0c0e` }}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-muted">{new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {p.readMinutes} min</p>
              <h2 className={`mt-3 font-display leading-tight text-foreground ${i === 0 ? "text-3xl" : "text-xl"}`}>{p.title}</h2>
              <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-muted-strong">{p.description}</p>
              <span className="mt-4 inline-block text-sm text-brand-light">Read <span className="inline-block transition-transform group-hover:translate-x-1">→</span></span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
