import Link from "next/link";
import { POLICIES, SAFETY_EMAIL, SAFETY_UPDATED } from "@/lib/safety/policies";

const QUICK = [
  { t: "Skip", d: "End any scene instantly. No reason needed.", i: "M5 4l10 8-10 8zM19 5v14" },
  { t: "Block", d: "They can never match or message you again.", i: "M12 22a10 10 0 110-20 10 10 0 010 20zM4.9 4.9l14.2 14.2" },
  { t: "Report", d: "Our moderators review it, minors and threats first.", i: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" },
  { t: "Stay anonymous", d: "Nothing about you is shown until you both reveal.", i: "M12 3a9 9 0 100 18 9 9 0 000-18zM4.5 12c3.6-3 9.4-3 13 0-3.6 3-9.4 3-13 0z" },
];

export default function SafetyPage() {
  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-10 text-foreground sm:px-6 md:pt-14">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm uppercase tracking-[0.25em] text-brand-light">Safety Center</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl leading-tight md:text-5xl">
          Play boldly. <span className="gradient-text">Stay safe.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[17px] text-muted-strong">
          How we protect you, what isn&rsquo;t allowed, and what to do when something feels wrong.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK.map((q) => (
            <div key={q.t} className="rounded-[1.5rem] bg-white/[.03] p-5 ring-1 ring-white/[.06]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand-light" aria-hidden="true"><path d={q.i} /></svg>
              <h2 className="mt-3 text-[17px]">{q.t}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-strong">{q.d}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 font-display text-2xl">Policies</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {POLICIES.map((p) => (
            <Link
              key={p.slug}
              href={`/safety/${p.slug}`}
              className="group flex gap-4 rounded-[1.5rem] bg-white/[.03] p-5 ring-1 ring-white/[.06] transition-colors hover:ring-brand/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-light">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={p.icon} /></svg>
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[17px] text-foreground">
                  {p.title}
                  <span aria-hidden="true" className="text-muted transition-transform group-hover:translate-x-1">→</span>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-strong">{p.summary}</span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-12 grid gap-3 md:grid-cols-2">
          <div className="rounded-[1.5rem] bg-danger/10 p-6 ring-1 ring-danger/30">
            <h2 className="text-[17px]">In danger right now?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-strong">
              Contact your local emergency number. Free, confidential support:{" "}
              <a className="text-brand-light underline" href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a>.
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-white/[.03] p-6 ring-1 ring-white/[.06]">
            <h2 className="text-[17px]">Talk to our safety team</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-strong">
              Reports, appeals and parent requests: <a className="text-brand-light underline" href={`mailto:${SAFETY_EMAIL}`}>{SAFETY_EMAIL}</a>
            </p>
          </div>
        </div>
        <p className="mt-8 text-xs text-muted">Last updated {SAFETY_UPDATED}</p>
      </div>
    </div>
  );
}
