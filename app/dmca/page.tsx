import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import LegalLayout, { type LegalSection } from "@/components/legal/LegalLayout";

const LEGAL = "legal@sweetscene.love";

export const metadata: Metadata = pageMeta({
  title: "Copyright & Takedown (DMCA)",
  description: "How to report copyright infringement or misuse of your likeness on SweetScene, and how to file a counter-notice.",
  path: "/dmca",
});

const sections: LegalSection[] = [
  {
    id: "overview",
    title: "Overview",
    body: (
      <p>
        We respect intellectual property and personal likeness. If you believe content on SweetScene infringes your
        copyright, or uses your face, name or identity without consent, tell us and we&rsquo;ll act quickly. Likeness
        complaints don&rsquo;t require any legal formality; we remove those on request.
      </p>
    ),
  },
  {
    id: "notice",
    title: "Filing a copyright notice",
    body: (
      <>
        <p>Email <a href={`mailto:${LEGAL}?subject=DMCA%20notice`}>{LEGAL}</a> with the subject &ldquo;DMCA notice&rdquo; and include:</p>
        <ol>
          <li>Your full name, address, phone and email.</li>
          <li>A description of the copyrighted work you own (or represent).</li>
          <li>The exact URL(s) of the content on SweetScene you believe infringes it.</li>
          <li>This statement: &ldquo;I have a good-faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.&rdquo;</li>
          <li>This statement: &ldquo;The information in this notice is accurate, and under penalty of perjury, I am the owner, or authorized to act on behalf of the owner, of an exclusive right that is allegedly infringed.&rdquo;</li>
          <li>Your physical or electronic signature.</li>
        </ol>
      </>
    ),
  },
  {
    id: "what-happens",
    title: "What happens next",
    body: (
      <ul>
        <li>We review complete notices, usually within 2 business days.</li>
        <li>If valid, we remove or disable the content and notify the person who posted it.</li>
        <li>Accounts that repeatedly infringe are terminated.</li>
      </ul>
    ),
  },
  {
    id: "counter",
    title: "Counter-notice",
    body: (
      <>
        <p>If your content was removed and you believe it was a mistake or you have the right to use it, send a counter-notice to {LEGAL} with:</p>
        <ol>
          <li>Your name, address, phone and email.</li>
          <li>The removed content and where it appeared.</li>
          <li>A statement under penalty of perjury that you have a good-faith belief it was removed by mistake or misidentification.</li>
          <li>Consent to the jurisdiction of the courts where you live (or, if outside the US, any judicial district where we may be found), and to accept service from the original complainant.</li>
          <li>Your signature.</li>
        </ol>
        <p>We forward valid counter-notices to the complainant and may restore the content after 10–14 business days unless they tell us they&rsquo;ve filed a court action.</p>
      </>
    ),
  },
  {
    id: "likeness",
    title: "Your face or identity",
    body: (
      <p>
        If a character or image looks like you, uses your name, or depicts you in any way without consent, email{" "}
        <a href={`mailto:${LEGAL}?subject=Likeness`}>{LEGAL}</a> with a link. We remove it without asking for proof of
        copyright, and we ban accounts that create sexual or degrading content of real people.
      </p>
    ),
  },
  {
    id: "misuse",
    title: "False notices",
    body: <p>Knowingly false notices or counter-notices may carry legal liability. Please only report content you have a genuine claim to. See also our <Link href="/terms">Terms</Link>.</p>,
  },
];

export default function DmcaPage() {
  return <LegalLayout eyebrow="Legal" title="Copyright & Takedown" current="/dmca" intro={<p>Report stolen work or misuse of your likeness. Likeness reports are honoured without question.</p>} sections={sections} />;
}
