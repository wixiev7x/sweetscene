import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, listPosts } from "@/lib/blog";
import Markdown from "@/components/blog/Markdown";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sweetscene.love";

export async function generateStaticParams() {
  return (await listPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getPost((await params).slug);
  if (!p) return {};
  return {
    title: p.title,
    description: p.description,
    keywords: p.keywords,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { title: p.title, description: p.description, type: "article", publishedTime: p.date, url: `/blog/${p.slug}` },
    twitter: { card: "summary_large_image", title: p.title, description: p.description },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const p = await getPost(slug);
  if (!p) notFound();
  const others = (await listPosts()).filter((o) => o.slug !== slug).slice(0, 3);
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      datePublished: p.date,
      dateModified: p.date,
      keywords: p.keywords.join(", "),
      mainEntityOfPage: `${SITE}/blog/${p.slug}`,
      author: { "@type": "Organization", name: "SweetScene" },
      publisher: { "@type": "Organization", name: "SweetScene" },
    },
    ...(p.faq.length
      ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-8 text-foreground sm:px-6 md:pt-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <article className="mx-auto max-w-[720px]">
        <Link href="/blog" className="text-sm text-muted hover:text-foreground">← Blog</Link>
        <h1 className="mt-4 font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.1]">{p.title}</h1>
        <p className="mt-3 text-sm text-muted">{new Date(p.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · {p.readMinutes} min read</p>
        <div className="ss-prose mt-8">
          <Markdown source={p.body} />
        </div>
        <div className="mt-12 rounded-[1.75rem] p-7 ring-1 ring-brand/30" style={{ background: "radial-gradient(100% 120% at 0% 100%, rgba(225,36,92,.35), transparent 60%), #0c0c0e" }}>
          <p className="font-display text-2xl">Your next scene is waiting.</p>
          <p className="mt-2 text-[15px] text-muted-strong">Meet a stranger anonymously, or play solo with thousands of characters. Free to start.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/matchmake" className="flex h-12 items-center rounded-full bg-brand px-6 text-white">Find a match</Link>
            <Link href="/" className="flex h-12 items-center rounded-full bg-white/[.08] px-6">Browse characters</Link>
          </div>
        </div>
        {others.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-2xl">Keep reading</h2>
            <div className="mt-4 grid gap-3">
              {others.map((o) => (
                <Link key={o.slug} href={`/blog/${o.slug}`} className="rounded-2xl bg-white/[.03] p-5 ring-1 ring-white/[.06] hover:ring-brand/40">
                  <p className="text-[17px]">{o.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-strong">{o.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
