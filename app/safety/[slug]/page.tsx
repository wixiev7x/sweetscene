import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { POLICIES, getPolicy, SAFETY_UPDATED } from "@/lib/safety/policies";

export function generateStaticParams() {
  return POLICIES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = getPolicy((await params).slug);
  return p ? pageMeta({ title: `${p.title} · Safety`, description: p.summary, path: `/safety/${p.slug}` }) : {};
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = getPolicy((await params).slug);
  if (!p) notFound();
  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-10 text-foreground sm:px-6 md:pt-14">
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[230px_1fr]">
        <nav aria-label="Safety policies" className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            <Link href="/safety" className="mb-4 block text-sm text-muted hover:text-foreground">← Safety Center</Link>
            {POLICIES.map((q) => (
              <Link
                key={q.slug}
                href={`/safety/${q.slug}`}
                aria-current={q.slug === p.slug ? "page" : undefined}
                className={`block py-1.5 text-[15px] ${q.slug === p.slug ? "text-brand-light" : "text-muted-strong hover:text-foreground"}`}
              >
                {q.title}
              </Link>
            ))}
          </div>
        </nav>
        <article>
          <Link href="/safety" className="text-sm text-muted hover:text-foreground lg:hidden">← Safety Center</Link>
          <h1 className="mt-2 font-display text-4xl leading-tight">{p.title}</h1>
          <p className="mt-3 text-[17px] text-muted-strong">{p.summary}</p>
          <div className="ss-prose mt-8 max-w-2xl">
            {p.sections.map((s) => (
              <section key={s.h}>
                <h2>{s.h}</h2>
                {s.body}
              </section>
            ))}
          </div>
          <p className="mt-12 text-xs text-muted">Last updated {SAFETY_UPDATED}</p>
        </article>
      </div>
    </div>
  );
}
