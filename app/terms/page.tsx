import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Terms of Service",
  description:
    "The rules of the scene — age requirements, anonymity, NSFW policy, moderation, payments, and refunds.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-void-950 text-white">
      <div className="fixed inset-0 pointer-events-none candle-wash" />

      <article className="max-w-2xl mx-auto px-6 py-12 space-y-8 text-foreground-dim leading-relaxed">
        <h1 className="type-display text-3xl text-white tracking-wide">Terms of Service</h1>
        <p className="type-meta text-muted">Last modified: September 10, 2026</p>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">1. Age Requirement</h2>
          <p className="type-body">
            You must be at least <strong>16 years of age</strong> to use SweetScene. By creating an
            account, you confirm that you meet this requirement. Users under 18 are classified as
            minors and are restricted from accessing NSFW (Not Safe For Work) content. NSFW
            content requires explicit opt-in and is only accessible to accounts verified as adults
            (18+).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">2. Anonymous Platform</h2>
          <p className="type-body">
            SweetScene is an anonymous platform. You interact under a pseudonymous username. We do
            not display your real identity to other users. However, we collect and store account
            metadata (email, IP address, device information) for security, moderation, and legal
            compliance purposes as described in our Privacy Policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">3. NSFW Content &amp; Opt-In</h2>
          <p className="type-body">
            The platform includes user-generated and AI-generated content that may be sexual or
            explicit in nature. NSFW content is gated behind an explicit opt-in mechanism and is
            only available to accounts whose age has been verified as 18+. By opting in, you
            acknowledge that you are of legal age in your jurisdiction to access adult content.
          </p>
          <p className="type-body">
            You may revoke your NSFW opt-in at any time from your profile settings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">4. Automated Moderation</h2>
          <p className="type-body">
            We employ automated AI-powered moderation systems to screen messages, character
            prompts, and user-generated content for policy violations. This includes but is not
            limited to detection of illegal content, harassment, and attempts to de-anonymize
            users. Automated moderation runs on all messages and is performed server-side. You
            consent to this processing as a condition of use.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">5. No Media in Direct Messages</h2>
          <p className="type-body">
            Direct messages (DMs) between matched users are text-only. Images, videos, audio, and
            base64-encoded data are prohibited in DMs. This policy is enforced both client-side
            and server-side. Attempts to bypass this restriction may result in account suspension.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">6. Law Enforcement Disclosure</h2>
          <p className="type-body">
            We may disclose account information, including encrypted message content, metadata,
            and IP addresses, to law enforcement agencies in response to valid legal process
            (subpoenas, court orders, or other lawful requests). We do not warrant that encryption
            is unbreakable or that anonymization is absolute. Illegal activity will be reported to
            the appropriate authorities.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">7. Token Economy &amp; Refund Policy</h2>
          <p className="type-body">
            Certain platform features consume tokens (matchmaking, AI roleplay, messaging). Tokens
            can be earned through daily activity, or purchased via NOWPayments cryptocurrency
            payments. VIP passes provide unlimited matches and Deep Dive access for a 30-day
            period.
          </p>
          <p className="type-body">
            <strong>Refund Policy:</strong> Token purchases are non-refundable once the payment is
            confirmed and tokens are credited to your account. VIP passes are non-refundable once
            activated. If a payment fails but you are charged, contact support with your payment
            ID for investigation. Refunds for technical failures (tokens deducted without service
            rendered) are issued at the platform&rsquo;s discretion as account credit.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">8. Acceptable Use</h2>
          <p className="type-body">
            You agree not to: (a) attempt to de-anonymize other users, (b) share your account
            credentials, (c) use the platform for illegal activities, (d) attempt to bypass
            content moderation or payment systems, or (e) scrape or automate access without
            permission. Violations may result in immediate account termination.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">9. Service Availability</h2>
          <p className="type-body">
            The platform is provided &quot;as is&quot; without warranty of availability. We do not
            guarantee uninterrupted service. AI features depend on third-party providers and may
            be unavailable without notice.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">10. Changes to Terms</h2>
          <p className="type-body">
            We may update these terms at any time. Continued use after changes constitutes
            acceptance of the updated terms. Material changes will be announced on the platform.
          </p>
        </section>

        <div className="pt-8 border-t border-white/5">
          <Link href="/" className="type-body text-brand-light hover:text-brand-lighter transition-colors">
            &larr; Back to SweetScene
          </Link>
        </div>
      </article>
    </div>
  );
}
