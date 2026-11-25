import Link from "next/link";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

export const LEGAL_UPDATED = "November 25, 2026";
export const SUPPORT_EMAIL = "support@sweetscene.love";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refunds", label: "Refund Policy" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/dmca", label: "Copyright & Takedown" },
  { href: "/content-statement", label: "Content & Age Statement" },
  { href: "/guidelines", label: "Community Guidelines" },
  { href: "/safety", label: "Safety Center" },
  { href: "/contact", label: "Contact" },
];

/**
 * Shared shell for policy pages: title block, sticky table of contents
 * on desktop, and a consistent prose column.
 */
export default function LegalLayout({
  eyebrow,
  title,
  intro,
  sections,
  current,
}: {
  eyebrow: string;
  title: string;
  intro: React.ReactNode;
  sections: LegalSection[];
  current: string;
}) {
  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-10 text-foreground sm:px-6 md:pt-14">
      <div className="mx-auto max-w-5xl">
        <p className="type-eyebrow text-accent-candle">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl text-foreground md:text-5xl">{title}</h1>
        <p className="mt-3 text-xs text-muted">Last updated {LEGAL_UPDATED}</p>
        <div className="mt-6 max-w-2xl text-base leading-relaxed text-muted-strong">{intro}</div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[220px_1fr]">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-20 space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">On this page</p>
                <ol className="mt-3 space-y-2 text-sm">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="text-muted-strong transition-colors hover:text-accent-candle">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Policies</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {LEGAL_LINKS.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        aria-current={l.href === current ? "page" : undefined}
                        className={l.href === current ? "text-accent-candle" : "text-muted-strong hover:text-foreground"}
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </nav>

          <article className="ss-prose max-w-2xl">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-20">
                <h2>{s.title}</h2>
                {s.body}
              </section>
            ))}
            <hr className="!mt-16 border-line" />
            <p className="text-sm text-muted">
              Questions about this page? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}
