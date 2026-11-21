import Link from "next/link";

const STEPS = [
  {
    n: "01",
    title: "Pick a mode & match",
    body: "Quick Match, By Vibe, Blind Date or a private Invite Room. You're paired with a real person in your age group — no names, no photos.",
  },
  {
    n: "02",
    title: "Play the scene together",
    body: "An AI director sets the stage, plays side characters and throws in twists to keep the story moving. You both improvise as your characters.",
  },
  {
    n: "03",
    title: "Reveal — or skip",
    body: "If the chemistry was there, both tap Reveal and continue in DMs. If not, skip and you're straight back in the queue.",
  },
  {
    n: "04",
    title: "Play solo anytime",
    body: "No match yet? Start a scene with any community character while you wait — or create your own for others to meet.",
  },
];

const TERMS = [
  ["Tokens", "Power the AI director and solo characters. Free tokens refill daily on Spark; paid plans add a monthly allowance. Your balance is always visible."],
  ["Scene", "One story session between two players and the AI director."],
  ["Reveal", "Mutual opt-in to show your profiles to each other. Nothing is shown unless you both choose it."],
  ["Skip", "End the scene and move on. No hard feelings, no explanation required."],
];

export default function HowPage() {
  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-10 text-foreground sm:px-6 md:pt-14">
      <div className="mx-auto max-w-5xl">
        <p className="type-eyebrow text-accent-candle">How it works</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl md:text-5xl">
          Strangers, a story, and <span className="gradient-text italic">a choice.</span>
        </h1>
        <ol className="mt-12 grid gap-4 sm:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-3xl border border-line bg-surface/50 p-7">
              <span className="font-display text-5xl italic text-accent-candle/30">{s.n}</span>
              <h2 className="mt-3 text-lg font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-strong">{s.body}</p>
            </li>
          ))}
        </ol>
        <section className="mt-16">
          <h2 className="font-display text-2xl">The vocabulary</h2>
          <dl className="mt-6 divide-y divide-line rounded-3xl border border-line bg-surface/40">
            {TERMS.map(([t, d]) => (
              <div key={t} className="grid gap-1 p-5 sm:grid-cols-[140px_1fr]">
                <dt className="font-semibold text-foreground">{t}</dt>
                <dd className="text-sm leading-relaxed text-muted-strong">{d}</dd>
              </div>
            ))}
          </dl>
        </section>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/matchmake" className="inline-flex h-12 items-center rounded-full bg-gradient-to-r from-brand-light to-brand px-7 text-[15px] font-semibold text-white ios-press">
            Start matching
          </Link>
          <Link href="/store" className="inline-flex h-12 items-center rounded-full border border-line-strong px-6 text-[15px] font-medium ios-press">
            See plans
          </Link>
        </div>
      </div>
    </div>
  );
}
