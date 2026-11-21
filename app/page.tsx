import type { Metadata } from "next";
import Link from "next/link";
import SoloRow from "@/components/home/SoloRow";
import { TIERS, COMPARISON_BADGE, COMPARISON_NOTE, formatUsd } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: { absolute: "SweetScene — Anonymous Matchmaking for AI Roleplay" },
  description:
    "Get matched anonymously with a real person, play out an AI-directed roleplay scene together, then both reveal — or skip to the next match. Free to start.",
  alternates: { canonical: "/" },
};

const STEPS = [
  {
    n: "01",
    title: "Match",
    body: "Pick a mode and get paired with a real person. No names, no photos — just two anonymous players.",
  },
  {
    n: "02",
    title: "Play the scene",
    body: "An AI director sets the scene and keeps the story moving while you two improvise your characters.",
  },
  {
    n: "03",
    title: "Reveal — or skip",
    body: "Loved the chemistry? Both tap reveal and keep talking in DMs. Not feeling it? Skip to the next match.",
  },
];

const MODES = [
  {
    href: "/matchmake?mode=quick",
    name: "Quick Match",
    body: "Say who you'd like to meet and jump straight into a scene.",
    tag: "Fastest",
    icon: "M13 2L3 14h7l-1 8 10-12h-7l1-8z",
    tone: "from-accent-candle/25",
  },
  {
    href: "/matchmake?mode=vibe",
    name: "By Vibe",
    body: "Choose up to five moods and meet someone who picked the same.",
    tag: "Shared interests",
    icon: "M12 21s-7-4.6-9.3-8.4C1 9.6 2.4 6 5.7 6c2 0 3.2 1.1 4.3 2.6C11.1 7.1 12.3 6 14.3 6c3.3 0 4.7 3.6 3 6.6C19 16.4 12 21 12 21z",
    tone: "from-accent-rose/25",
  },
  {
    href: "/matchmake?mode=blind",
    name: "Blind Date",
    body: "No profiles at all. When the scene ends, you both walk away.",
    tag: "Full anonymity",
    icon: "M12 3a9 9 0 100 18 9 9 0 000-18zM4.5 12c3.6-3 9.4-3 13 0-3.6 3-9.4 3-13 0z",
    tone: "from-muted/20",
  },
  {
    href: "/matchmake?mode=invite",
    name: "Invite Room",
    body: "A private scene for friends, with a link only you control.",
    tag: "Private",
    icon: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
    tone: "from-info/25",
  },
];

const PROMISES = [
  { title: "Anonymous by default", body: "A generated username is all anyone sees. Your email and identity stay private." },
  { title: "Reveal is mutual", body: "Nothing about you is shown unless both players choose to reveal." },
  { title: "Age-separated", body: "Under-18 members are only ever matched with other under-18 members." },
  { title: "Encrypted & moderated", body: "Messages are encrypted at rest, and you can report or block anyone in one tap." },
];

const FAQ = [
  {
    q: "What is SweetScene?",
    a: "SweetScene is an anonymous matchmaking platform for AI roleplay. You're paired with a real person, an AI director sets up and guides a story scene, and you both play characters. Afterwards you can both reveal and keep chatting — or skip to the next match.",
  },
  {
    q: "Is it free?",
    a: "Yes. The Spark plan is free forever: unlimited matches in every mode and free tokens refilled daily. Paid plans start at $1.99/month for longer scenes.",
  },
  {
    q: "What are tokens?",
    a: "Tokens power the AI that directs your scenes and plays solo characters. Matches themselves are always unlimited. You can always see your balance, and if a scene runs low you can finish it with a one-time top-up.",
  },
  {
    q: "Will the other person know who I am?",
    a: "No. You appear under an anonymous username. Your profile is only revealed if you both choose to reveal.",
  },
  {
    q: "What if no one is online?",
    a: "Play solo while you wait. Pick any community character and start a scene with the AI — we'll pull you into a match as soon as one is ready.",
  },
  {
    q: "Who can join?",
    a: "SweetScene is for people aged 16 and over. Members under 18 are only matched with other under-18 members and never see mature content.",
  },
];

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Pure-CSS hero illustration: two anonymous players meeting in a scene. */
function HeroScene() {
  return (
    <div className="relative mx-auto w-full max-w-sm ss-rise" style={{ "--d": 3 } as React.CSSProperties}>
      <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand)_35%,transparent),transparent)] ss-glow" />
      <div className="rounded-3xl border border-line-strong bg-surface/80 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-candle to-accent-rose font-display text-sm italic text-void-950">m</span>
            <div>
              <p className="text-sm font-semibold text-foreground">midnight_fox</p>
              <p className="text-[11px] text-muted">Anonymous · matched just now</p>
            </div>
          </div>
          <span className="rounded-full border border-accent-candle/40 bg-accent-candle/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-candle">
            Scene 1
          </span>
        </div>

        <div className="mt-4 rounded-2xl bg-void-950/60 p-3 text-[13px] leading-relaxed text-muted-strong">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-accent-candle">AI director</span>
          <p className="mt-1 italic">Rain against the café window. Last table open — and someone is already sitting there, reading your favorite book…</p>
        </div>

        <div className="mt-3 space-y-2">
          <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-brand/90 px-3 py-2 text-[13px] text-white">“Mind if I share the table? Good taste in books, by the way.”</p>
          <p className="max-w-[80%] rounded-2xl rounded-bl-md bg-surface-raised px-3 py-2 text-[13px] text-foreground-dim">“Only if you can guess how it ends.” <span className="text-muted">*slides the book over*</span></p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <span className="flex h-10 items-center justify-center rounded-full border border-line-strong text-xs font-semibold text-muted-strong">Skip</span>
          <span className="flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-accent-candle to-accent-rose text-xs font-semibold text-void-950 ss-pulse">Reveal ♥</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* ── Hero ── */}
      <section className="relative px-4 pb-16 pt-10 sm:px-6 md:pt-16">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--accent-rose)_22%,transparent),transparent)] ss-glow" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Link
              href="/store"
              className="ss-rise inline-flex items-center gap-2 rounded-full border border-accent-candle/30 bg-accent-candle/10 px-3 py-1.5 text-xs font-semibold text-accent-candle"
            >
              <span aria-hidden="true">✦</span> {COMPARISON_BADGE}
            </Link>
            <h1 className="ss-rise mt-5 font-display text-[clamp(2.6rem,7vw,4.6rem)] leading-[1.02] text-foreground" style={{ "--d": 1 } as React.CSSProperties}>
              Match. Roleplay.
              <br />
              <span className="gradient-text italic">Reveal</span> — or skip.
            </h1>
            <p className="ss-rise mt-6 max-w-xl text-base leading-relaxed text-muted-strong md:text-lg" style={{ "--d": 2 } as React.CSSProperties}>
              Get matched anonymously with a real person, play out a story scene directed by AI, then decide together whether to reveal. No faces, no pressure — just chemistry.
            </p>
            <div className="ss-rise mt-8 flex flex-wrap items-center gap-3" style={{ "--d": 3 } as React.CSSProperties}>
              <Link
                href="/matchmake"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-brand-light to-brand px-7 text-[15px] font-semibold text-white shadow-[0_10px_34px_-10px_var(--brand)] transition-transform duration-200 hover:-translate-y-0.5 ios-press"
              >
                <span aria-hidden="true">♥</span> Start matching
              </Link>
              <Link
                href="/explore"
                className="inline-flex h-12 items-center rounded-full border border-line-strong px-6 text-[15px] font-medium text-foreground transition-colors hover:border-accent-candle hover:text-accent-candle ios-press"
              >
                Play solo
              </Link>
            </div>
            <p className="ss-rise mt-5 text-xs text-muted" style={{ "--d": 4 } as React.CSSProperties}>
              Free forever plan · No credit card · 16+
            </p>
          </div>
          <HeroScene />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-4 py-16 sm:px-6" aria-labelledby="how-title">
        <div className="mx-auto max-w-6xl">
          <p className="type-eyebrow text-accent-candle">How it works</p>
          <h2 id="how-title" className="mt-3 font-display text-3xl text-foreground md:text-4xl">Three steps. Endless stories.</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.n} className="ss-rise relative rounded-3xl border border-line bg-surface/60 p-6" style={{ "--d": i } as React.CSSProperties}>
                <span className="font-display text-5xl italic text-accent-candle/30">{s.n}</span>
                <h3 className="mt-3 text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-strong">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Modes ── */}
      <section className="px-4 py-16 sm:px-6" aria-labelledby="modes-title">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="type-eyebrow text-accent-candle">Four ways to meet</p>
              <h2 id="modes-title" className="mt-3 font-display text-3xl text-foreground md:text-4xl">Pick your mode.</h2>
            </div>
            <Link href="/matchmake" className="text-sm font-semibold text-accent-candle hover:underline">See all modes →</Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODES.map((m) => (
              <Link
                key={m.name}
                href={m.href}
                className={`group relative overflow-hidden rounded-3xl border border-line bg-gradient-to-b ${m.tone} to-surface/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-line-strong ios-press`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-void-950/50 text-foreground">
                  <Icon d={m.icon} />
                </span>
                <h3 className="mt-5 font-display text-xl text-foreground">{m.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-strong">{m.body}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
                  {m.tag}
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solo while you wait ── */}
      <section className="px-4 py-16 sm:px-6" aria-labelledby="solo-title">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="type-eyebrow text-accent-candle">While you wait</p>
              <h2 id="solo-title" className="mt-3 font-display text-3xl text-foreground md:text-4xl">Never wait alone.</h2>
              <p className="mt-3 max-w-lg text-sm text-muted-strong">
                Start a solo scene with a community character. The moment a match is ready, we&apos;ll bring you in.
              </p>
            </div>
            <Link href="/explore" className="text-sm font-semibold text-accent-candle hover:underline">Explore characters →</Link>
          </div>
          <div className="mt-8">
            <SoloRow />
          </div>
          <div className="mt-8 flex flex-col items-start gap-4 rounded-3xl border border-line bg-gradient-to-r from-brand/15 via-surface/60 to-accent-candle/10 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-xl text-foreground">Create your own character</h3>
              <p className="mt-1 text-sm text-muted-strong">Give them a personality and an opening line — then let others meet them.</p>
            </div>
            <Link href="/create" className="inline-flex h-11 shrink-0 items-center rounded-full bg-foreground px-6 text-sm font-semibold text-void-950 ios-press">
              Start creating
            </Link>
          </div>
        </div>
      </section>

      {/* ── Promises ── */}
      <section className="px-4 py-16 sm:px-6" aria-labelledby="safe-title">
        <div className="mx-auto max-w-6xl">
          <p className="type-eyebrow text-accent-candle">Built for trust</p>
          <h2 id="safe-title" className="mt-3 font-display text-3xl text-foreground md:text-4xl">Private by design.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROMISES.map((p) => (
              <div key={p.title} className="rounded-3xl border border-line bg-surface/50 p-6">
                <h3 className="text-base font-semibold text-foreground">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-strong">{p.body}</p>
              </div>
            ))}
          </div>
          <Link href="/safety" className="mt-6 inline-block text-sm font-semibold text-accent-candle hover:underline">Visit the Safety Center →</Link>
        </div>
      </section>

      {/* ── Pricing teaser ── */}
      <section className="px-4 py-16 sm:px-6" aria-labelledby="price-title">
        <div className="mx-auto max-w-6xl">
          <p className="type-eyebrow text-accent-candle">Plans</p>
          <h2 id="price-title" className="mt-3 font-display text-3xl text-foreground md:text-4xl">Free to play. Cheap to love.</h2>
          <p className="mt-3 max-w-xl text-sm text-muted-strong">Matches are unlimited on every plan. Upgrade only if you want longer scenes.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t) => (
              <div
                key={t.id}
                className={`relative rounded-3xl border p-6 ${t.highlight ? "border-brand/60 bg-gradient-to-b from-brand/15 to-surface/60" : "border-line bg-surface/50"}`}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Most loved</span>
                )}
                <h3 className="font-display text-2xl text-foreground">{t.name}</h3>
                <p className="mt-1 text-xs text-muted">{t.tagline}</p>
                <p className="mt-5 text-3xl font-semibold text-foreground">
                  {formatUsd(t.monthlyUsd)}
                  <span className="text-sm font-normal text-muted">{t.monthlyUsd ? " /month" : " forever"}</span>
                </p>
                <p className="mt-3 text-sm text-muted-strong">
                  {t.tokens.toLocaleString("en-US")} tokens {t.tokenPeriod === "day" ? "daily" : "monthly"}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link href="/store" className="inline-flex h-11 items-center rounded-full bg-gradient-to-r from-brand-light to-brand px-6 text-sm font-semibold text-white ios-press">
              Compare plans
            </Link>
            <p className="text-xs text-muted">{COMPARISON_NOTE}</p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-4 py-16 sm:px-6" aria-labelledby="faq-title">
        <div className="mx-auto max-w-3xl">
          <p className="type-eyebrow text-accent-candle">FAQ</p>
          <h2 id="faq-title" className="mt-3 font-display text-3xl text-foreground md:text-4xl">Good questions.</h2>
          <div className="mt-8 divide-y divide-line rounded-3xl border border-line bg-surface/50">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-foreground">
                  {f.q}
                  <span aria-hidden="true" className="text-accent-candle transition-transform duration-300 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-strong">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-4 pb-24 pt-8 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-line-strong bg-gradient-to-br from-brand/25 via-surface to-accent-candle/15 px-6 py-14 text-center">
          <h2 className="font-display text-3xl text-foreground md:text-5xl">
            Your next scene is <span className="gradient-text italic">one tap</span> away.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-strong">Free forever plan. No credit card. Be matched in seconds.</p>
          <Link
            href="/matchmake"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-8 text-[15px] font-semibold text-void-950 transition-transform hover:-translate-y-0.5 ios-press"
          >
            <span aria-hidden="true">♥</span> Start matching
          </Link>
        </div>
      </section>
    </div>
  );
}
