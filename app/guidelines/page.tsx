import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { SFW_MODE } from "@/lib/utils/sfw";
import LegalLayout, { type LegalSection } from "@/components/legal/LegalLayout";

export const metadata: Metadata = pageMeta({
  title: "Community Guidelines",
  description: "How to play fair on SweetScene: respect, consent, clear boundaries and zero tolerance for harm.",
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
        <li>Reveal is mutual by design, don&rsquo;t ask for photos, real names, social handles or locations.</li>
        <li>Out-of-character requests to stop are final.</li>
      </ul>
    ),
  },
  {
    id: "content",
    title: SFW_MODE ? "Keep it safe-for-work" : "Content boundaries",
    body: (
      <>
        <p>
          {SFW_MODE
            ? "Romance, drama, mystery and tension are welcome. These are not:"
            : "Romance, drama, tension, and for opted-in adults in 18+ mode, explicit scenes between fictional adults are welcome. These are not:"}
        </p>
        <ul>
          <li>{SFW_MODE ? "Sexually explicit content of any kind." : "Explicit content outside 18+ mode, or adult characters not marked 18+."}</li>
          <li>Any sexual or romantic content involving minors, including fictional characters who are, or appear to be, under 18. Zero tolerance; reported to authorities.</li>
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
    id: "dms",
    title: "Reveals and DMs",
    body: (
      <ul>
        <li>Revealing is a gift, not an obligation. Never guilt anyone into it.</li>
        <li>Don&rsquo;t ask for photos, socials, phone numbers or meetups in the first conversation.</li>
        <li>Never share screenshots of private chats to embarrass or identify someone.</li>
        <li>No selling, advertising or sending people to paid content elsewhere.</li>
      </ul>
    ),
  },
  {
    id: "teens",
    title: "Members aged 16–17",
    body: (
      <ul>
        <li>Teens play in their own space with other teens only, and everything stays safe-for-work.</li>
        <li>Romance between teens is fine when it&rsquo;s respectful and non-sexual.</li>
        <li>Adults trying to reach teens, or teens claiming to be adults, are banned permanently.</li>
      </ul>
    ),
  },
  {
    id: "wellbeing",
    title: "Look after yourself",
    body: (
      <p>
        Roleplay can get intense. Take breaks, set your own limits, and step away from anything that stops feeling good.
        If you&rsquo;re struggling, free and confidential support is at{" "}
        <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a>.
      </p>
    ),
  },
  {
    id: "strikes",
    title: "Strikes",
    body: (
      <table>
        <thead><tr><th>Severity</th><th>Examples</th><th>Usual action</th></tr></thead>
        <tbody>
          <tr><td>Minor</td><td>Spam, mild rudeness, mislabelled tags</td><td>Warning, content edited or removed</td></tr>
          <tr><td>Serious</td><td>Harassment, unmarked adult content, real-person images</td><td>Temporary suspension, publishing removed</td></tr>
          <tr><td>Severe</td><td>Anything involving minors, threats, doxxing, age lying</td><td>Permanent ban, reported where required</td></tr>
        </tbody>
      </table>
    ),
  },
  {
    id: "enforcement",
    title: "Reporting and enforcement",
    body: (
      <p>
        Use <strong>Report</strong> or <strong>Block</strong> from any chat menu. Reports are reviewed by our moderation
        team. Depending on severity we may warn, restrict features, or permanently ban, and we cooperate with law
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
