import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import LegalLayout, { type LegalSection } from "@/components/legal/LegalLayout";

export const metadata: Metadata = pageMeta({
  title: "Community Guidelines",
  description: "How to play fair on SweetScene: respect, consent, safe-for-work stories and zero tolerance for harm.",
  path: "/guidelines",
});

const sections: LegalSection[] = [
  {
    id: "spirit",
    title: "The spirit of the scene",
    body: (
      <p>
        SweetScene works because strangers trust each other enough to play. Every scene has a real person on the other
        side. Be the partner you&rsquo;d want to be matched with: creative, respectful, and quick to step out if the
        other person isn&rsquo;t enjoying it.
      </p>
    ),
  },
  {
    id: "consent",
    title: "Consent and boundaries",
    body: (
      <ul>
        <li>Check in. If your partner steers away from a story direction, follow their lead.</li>
        <li>&ldquo;Skip&rdquo; is always okay. Never pressure anyone to stay, reveal or move to DMs.</li>
        <li>Reveal is mutual by design — don&rsquo;t ask for photos, real names, social handles or locations.</li>
        <li>Out-of-character requests to stop are final.</li>
      </ul>
    ),
  },
  {
    id: "content",
    title: "Keep it safe-for-work",
    body: (
      <>
        <p>Romance, drama, mystery and tension are welcome. These are not:</p>
        <ul>
          <li>Sexually explicit content of any kind.</li>
          <li>Any sexual or romantic content involving minors — including fictional characters who are, or appear to be, under 18. Zero tolerance; reported to authorities.</li>
          <li>Graphic violence, gore, or content that glorifies self-harm or suicide.</li>
          <li>Hate speech, slurs or harassment targeting real groups or people.</li>
          <li>Characters that impersonate real people.</li>
        </ul>
      </>
    ),
  },
  {
    id: "age",
    title: "Age groups",
    body: (
      <p>
        Members aged 16–17 and members aged 18+ are kept in separate matchmaking pools and cannot message each other.
        Lying about your age, or trying to contact someone outside your age group, leads to a permanent ban.
      </p>
    ),
  },
  {
    id: "characters",
    title: "Creating characters",
    body: (
      <ul>
        <li>All characters must be clearly adults unless they are in non-romantic, all-ages stories.</li>
        <li>Use original characters or clearly transformative takes; don&rsquo;t upload art you don&rsquo;t have the rights to.</li>
        <li>Don&rsquo;t write character prompts designed to get around our filters.</li>
      </ul>
    ),
  },
  {
    id: "integrity",
    title: "Play fair",
    body: (
      <ul>
        <li>No spam, advertising, scams or selling.</li>
        <li>No bots, scripts or multiple accounts.</li>
        <li>No attempts to break, probe or overload the platform or the AI.</li>
      </ul>
    ),
  },
  {
    id: "enforcement",
    title: "Reporting and enforcement",
    body: (
      <p>
        Use <strong>Report</strong> or <strong>Block</strong> from any chat menu. Reports are reviewed by our moderation
        team. Depending on severity we may warn, restrict features, or permanently ban — and we cooperate with law
        enforcement on serious harm. See the <Link href="/safety">Safety Center</Link> for more.
      </p>
    ),
  },
];

export default function GuidelinesPage() {
  return (
    <LegalLayout
      eyebrow="Community"
      title="Community Guidelines"
      current="/guidelines"
      intro={<p>Great scenes need trust. These rules keep SweetScene fun, safe and anonymous for everyone.</p>}
      sections={sections}
    />
  );
}
