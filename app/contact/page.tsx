import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { SUPPORT_EMAIL } from "@/components/legal/LegalLayout";

export const metadata: Metadata = pageMeta({
  title: "Contact",
  description: "Get help with your SweetScene account, billing, safety reports or legal requests.",
  path: "/contact",
});

const CARDS = [
  {
    title: "Account & general help",
    body: "Login trouble, bugs, feature questions or feedback.",
    subject: "Help",
  },
  {
    title: "Billing & refunds",
    body: "Subscriptions, receipts, cancellations and refund requests. Include your Paddle order number if you have it.",
    subject: "Billing",
  },
  {
    title: "Safety report",
    body: "Report a member, a character or content that breaks our rules. In the app, use Report from the chat menu for the fastest review.",
    subject: "Safety report",
  },
  {
    title: "Privacy & legal",
    body: "Data access or deletion requests, copyright (DMCA) notices and law-enforcement requests.",
    subject: "Legal",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-10 text-foreground sm:px-6 md:pt-14">
      <div className="mx-auto max-w-4xl">
        <p className="type-eyebrow text-accent-candle">Contact</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">We&rsquo;re here to help.</h1>
        <p className="mt-4 max-w-xl text-muted-strong">
          Email <a className="text-accent-candle underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          We reply within 2 business days — usually much sooner. Pick a topic below so your message reaches the right place.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {CARDS.map((c) => (
            <a
              key={c.title}
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(c.subject)}`}
              className="group rounded-3xl border border-line bg-surface/50 p-6 transition-colors hover:border-line-strong ios-press"
            >
              <h2 className="text-lg font-semibold text-foreground">{c.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-strong">{c.body}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-accent-candle">
                Email us <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </span>
            </a>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-danger/40 bg-danger/10 p-6">
          <h2 className="text-base font-semibold text-foreground">In danger right now?</h2>
          <p className="mt-2 text-sm text-muted-strong">
            Contact your local emergency number. If you&rsquo;re struggling, you can find free, confidential support lines
            in your country at <a className="text-accent-candle underline" href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a>.
          </p>
        </div>

        <p className="mt-8 text-sm text-muted">
          Looking for answers first? See the <Link className="text-accent-candle underline" href="/safety">Safety Center</Link>,{" "}
          <Link className="text-accent-candle underline" href="/refunds">Refund Policy</Link> or{" "}
          <Link className="text-accent-candle underline" href="/how">How it works</Link>.
        </p>
      </div>
    </div>
  );
}
