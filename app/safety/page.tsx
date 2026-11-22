import Link from "next/link";
import { SUPPORT_EMAIL } from "@/components/legal/LegalLayout";

const PILLARS = [
  {
    title: "Anonymous by default",
    body: "You appear under a generated username. Your email, real name and location are never shown to other members.",
    icon: "M12 3a9 9 0 100 18 9 9 0 000-18zM4.5 12c3.6-3 9.4-3 13 0-3.6 3-9.4 3-13 0z",
  },
  {
    title: "Reveal only together",
    body: "Profiles are only revealed when both players tap Reveal. Either of you can skip at any moment, no explanation needed.",
    icon: "M12 21s-7-4.6-9.3-8.4C1 9.6 2.4 6 5.7 6c2 0 3.2 1.1 4.3 2.6C11.1 7.1 12.3 6 14.3 6c3.3 0 4.7 3.6 3 6.6C19 16.4 12 21 12 21z",
  },
  {
    title: "Separate age groups",
    body: "Members aged 16–17 are only ever matched with other 16–17 year olds. Adults only meet adults. Date of birth can't be changed once set.",
    icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87",
  },
  {
    title: "Moderated, always",
    body: "Every message and character passes automated safety filters, and reports are reviewed by people. The platform is safe-for-work.",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  },
  {
    title: "Encrypted at rest",
    body: "Messages are encrypted in our database. We never sell your data and don't use advertising trackers.",
    icon: "M5 11h14v10H5zM8 11V7a4 4 0 118 0v4",
  },
  {
    title: "Report & block in one tap",
    body: "Open the menu in any chat to report or block. Blocked members can never be matched with you again.",
    icon: "M4 4l16 16M12 22a10 10 0 110-20 10 10 0 010 20z",
  },
];

const TIPS = [
  "Keep personal details, real name, school, workplace, address, socials, out of scenes and DMs.",
  "Never send money, gift cards or codes to anyone you meet here.",
  "Be wary of anyone pushing you to move to another app quickly.",
  "If a scene stops feeling fun, skip. You don't owe anyone a reason.",
  "If someone makes you uncomfortable, block and report, it helps protect others too.",
];

const PARENTS = [
  "SweetScene is for ages 16+. Teens are kept in a separate matchmaking pool from adults.",
  "Teens never see mature content, and all content is safe-for-work.",
  "Parents or guardians can ask us to review or delete a teen's account by emailing us.",
];

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function SafetyPage() {
  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-10 text-foreground sm:px-6 md:pt-14">
      <div className="mx-auto max-w-5xl">
        <p className="type-eyebrow text-accent-candle">Safety Center</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl md:text-5xl">
          Play boldly. <span className="gradient-text italic">Stay safe.</span>
        </h1>
        <p className="mt-4 max-w-xl text-muted-strong">
          SweetScene is built so strangers can tell stories together without giving anything away. Here&rsquo;s how we
          protect you, and how you can protect yourself.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-3xl border border-line bg-surface/50 p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-candle/10 text-accent-candle">
                <Icon d={p.icon} />
              </span>
              <h2 className="mt-4 text-base font-semibold">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-strong">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          <section className="rounded-3xl border border-line bg-surface/40 p-7">
            <h2 className="font-display text-2xl">Your safety checklist</h2>
            <ul className="mt-5 space-y-3">
              {TIPS.map((t) => (
                <li key={t} className="flex gap-3 text-sm leading-relaxed text-muted-strong">
                  <span aria-hidden="true" className="mt-0.5 text-accent-rose">♥</span>
                  {t}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-3xl border border-line bg-surface/40 p-7">
            <h2 className="font-display text-2xl">For parents & guardians</h2>
            <ul className="mt-5 space-y-3">
              {PARENTS.map((t) => (
                <li key={t} className="flex gap-3 text-sm leading-relaxed text-muted-strong">
                  <span aria-hidden="true" className="mt-0.5 text-accent-candle">✦</span>
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-muted">
              Email <a className="text-accent-candle underline" href={`mailto:${SUPPORT_EMAIL}?subject=Parent%20request`}>{SUPPORT_EMAIL}</a>.
            </p>
          </section>
        </div>

        <section className="mt-16 rounded-3xl border border-line-strong bg-gradient-to-br from-brand/15 via-surface to-accent-candle/10 p-8">
          <h2 className="font-display text-2xl">How reporting works</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              ["Report", "Tap the menu in any chat, choose Report and pick a reason. The scene is saved for review."],
              ["Review", "Our moderation team reviews reports, prioritising anything involving minors or threats."],
              ["Action", "We warn, restrict or ban, and escalate to authorities when someone may be in danger."],
            ].map(([t, b], i) => (
              <li key={t}>
                <span className="font-display text-4xl italic text-accent-candle/40">0{i + 1}</span>
                <h3 className="mt-2 font-semibold">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-strong">{b}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-10 rounded-3xl border border-danger/40 bg-danger/10 p-6">
          <h2 className="text-base font-semibold">Need help now?</h2>
          <p className="mt-2 text-sm text-muted-strong">
            If you or someone else is in immediate danger, contact your local emergency number. For free, confidential
            support in your country, visit{" "}
            <a className="text-accent-candle underline" href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a>.
          </p>
        </div>

        <p className="mt-10 text-sm text-muted">
          Read the full <Link className="text-accent-candle underline" href="/guidelines">Community Guidelines</Link>,{" "}
          <Link className="text-accent-candle underline" href="/terms">Terms</Link> and{" "}
          <Link className="text-accent-candle underline" href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
