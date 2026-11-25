import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import LegalLayout, { type LegalSection } from "@/components/legal/LegalLayout";

export const metadata: Metadata = pageMeta({
  title: "Content & Age Statement",
  description: "SweetScene hosts AI-generated and illustrated fiction only. No real people are depicted. Statement on age, record-keeping and content standards.",
  path: "/content-statement",
});

const sections: LegalSection[] = [
  {
    id: "nature",
    title: "Nature of the content",
    body: (
      <p>
        SweetScene is an interactive fiction platform. Characters are fictional personas written by members and voiced by
        artificial intelligence. Character images are illustrations or AI-generated artwork uploaded by their creators.
        Matched scenes are text roleplay between anonymous members, directed by AI.
      </p>
    ),
  },
  {
    id: "no-real-people",
    title: "No real people depicted",
    body: (
      <p>
        No actual human being appears in any visual depiction on SweetScene, and no content is produced using real
        performers. Uploading photographs of real people for characters is prohibited, and images found to depict real
        people are removed.
      </p>
    ),
  },
  {
    id: "2257",
    title: "Record-keeping exemption (18 U.S.C. §2257)",
    body: (
      <p>
        Because SweetScene does not produce, host or distribute visual depictions of actual human beings engaged in
        sexually explicit conduct, the record-keeping requirements of 18 U.S.C. §2257 and 28 C.F.R. Part 75 do not apply
        to content on this platform. SweetScene is not a &ldquo;producer&rdquo; of any such depictions. Any member who
        believes content violates this statement should report it immediately.
      </p>
    ),
  },
  {
    id: "adults-only-characters",
    title: "All characters are adults",
    body: (
      <ul>
        <li>Every character in any romantic or adult context must be clearly 18 or older, in description and in imagery.</li>
        <li>Content that depicts or implies minors in a sexual or romantic context is prohibited and reported to the relevant authorities, including NCMEC.</li>
        <li>Stated adult ages do not excuse content that presents a character as a child.</li>
      </ul>
    ),
  },
  {
    id: "members",
    title: "Members and age groups",
    body: (
      <p>
        Members must be 16 or older. Members aged 16–17 use a separate, safe-for-work experience and are only matched with
        each other. Adult content is available only to members who are 18 or older, signed in, and have chosen to see it.
        See <Link href="/safety/age-and-minors">Age &amp; adult content</Link>.
      </p>
    ),
  },
  {
    id: "report",
    title: "Reporting",
    body: (
      <p>
        Report any concern from the content itself or at <a href="mailto:safety@sweetscene.love">safety@sweetscene.love</a>.
        Reports involving minors are reviewed first.
      </p>
    ),
  },
];

export default function ContentStatementPage() {
  return <LegalLayout eyebrow="Legal" title="Content & Age Statement" current="/content-statement" intro={<p>Fiction only. No real people. Every character an adult.</p>} sections={sections} />;
}
