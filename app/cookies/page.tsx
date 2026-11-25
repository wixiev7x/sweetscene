import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import LegalLayout, { SUPPORT_EMAIL, type LegalSection } from "@/components/legal/LegalLayout";

export const metadata: Metadata = pageMeta({
  title: "Cookie Policy",
  description: "Which cookies and local storage SweetScene uses, why, and how to control them. No advertising or cross-site tracking cookies.",
  path: "/cookies",
});

const sections: LegalSection[] = [
  {
    id: "summary",
    title: "The short version",
    body: (
      <ul>
        <li>We only use cookies and browser storage that make the site work, keep you signed in, and remember your choices.</li>
        <li>We do <strong>not</strong> use advertising cookies, cross-site trackers, or sell your data.</li>
        <li>Blocking essential cookies will sign you out and stop some features from working.</li>
      </ul>
    ),
  },
  {
    id: "what",
    title: "What cookies are",
    body: (
      <p>
        Cookies are small text files a website stores in your browser. &ldquo;Local storage&rdquo; is a similar browser
        feature that keeps small preferences on your device. Both stay on your device and are only readable by the site
        that set them.
      </p>
    ),
  },
  {
    id: "essential",
    title: "Essential cookies",
    body: (
      <>
        <p>These are required for the service to work and cannot be switched off in our settings:</p>
        <table>
          <thead><tr><th>Name</th><th>Purpose</th><th>Lasts</th></tr></thead>
          <tbody>
            <tr><td>sb-…-auth-token</td><td>Keeps you signed in securely</td><td>Session / up to 30 days</td></tr>
            <tr><td>sweetscene-remember</td><td>Remembers that you chose &ldquo;Remember me&rdquo;</td><td>30 days</td></tr>
            <tr><td>Cloudflare Turnstile</td><td>Protects sign-up and login from bots</td><td>Session</td></tr>
            <tr><td>Paddle checkout</td><td>Set by our payment provider during checkout only</td><td>Session</td></tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "preferences",
    title: "Preferences (local storage)",
    body: (
      <>
        <p>These remember choices you make, on your device only:</p>
        <ul>
          <li><strong>Sidebar</strong> collapsed or expanded.</li>
          <li><strong>Character previews</strong> on hover: on, off, or what they show.</li>
          <li><strong>Reply speed</strong> in chat.</li>
          <li><strong>Language</strong> you picked.</li>
          <li>A short count of free messages used before signing up.</li>
        </ul>
        <p>Clearing your browser data resets them. They are never sent to advertisers.</p>
      </>
    ),
  },
  {
    id: "analytics",
    title: "Analytics",
    body: (
      <p>
        If we measure site usage, we use privacy-friendly, cookieless analytics that count visits in aggregate and do not
        build a profile of you or follow you across other sites.
      </p>
    ),
  },
  {
    id: "control",
    title: "How to control cookies",
    body: (
      <p>
        You can delete or block cookies in your browser settings at any time. Most browsers also offer a private mode
        that clears them when you close the window. Because we only use essential cookies and preferences, there is no
        separate consent banner; blocking them will simply sign you out.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Questions",
    body: (
      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See also our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return <LegalLayout eyebrow="Legal" title="Cookie Policy" current="/cookies" intro={<p>Only what&rsquo;s needed to keep you signed in and remember your choices. No ad tracking, ever.</p>} sections={sections} />;
}
