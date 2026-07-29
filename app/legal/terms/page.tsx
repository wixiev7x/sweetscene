import Link from "next/link";

/**
 * Terms of Service page. Covers age requirement (16+), NSFW opt-in,
 * automated AI moderation, law-enforcement disclosure, no-media-in-DMs
 * policy, and refund policy. Not legal advice — have a lawyer review
 * before launch.
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(88,28,135,0.08)_0%,transparent_50%)]" />

      <nav className="sticky top-0 z-10 border-b border-white/5 backdrop-blur-md bg-black/40 px-6 py-4">
        <Link
          href="/"
          className="text-xl font-bold text-brand-light hover:text-brand-lighter transition-colors"
        >
          sweetscene
        </Link>
      </nav>

      <article className="max-w-2xl mx-auto px-6 py-12 space-y-8 text-foreground-dim leading-relaxed">
        <h1 className="text-3xl font-light text-white tracking-wide">
          Terms of Service
        </h1>
        <p className="text-sm text-muted">
          Last updated: 2026
        </p>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            1. Age Requirement
          </h2>
          <p className="text-sm">
            You must be at least <strong>16 years of age</strong> to use
            sweetscene. By creating an account, you confirm that you meet this
            requirement. Users under 18 are classified as minors and are
            restricted from accessing NSFW (Not Safe For Work) content. NSFW
            content requires explicit opt-in and is only accessible to
            accounts verified as adults (18+).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            2. Anonymous Platform
          </h2>
          <p className="text-sm">
            sweetscene is an anonymous platform. You interact under a pseudonymous
            username. We do not display your real identity to other users.
            However, we collect and store account metadata (email, IP address,
            device information) for security, moderation, and legal compliance
            purposes as described in our Privacy Policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            3. NSFW Content &amp; Opt-In
          </h2>
          <p className="text-sm">
            The platform includes user-generated and AI-generated content
            that may be sexual or explicit in nature. NSFW content is gated
            behind an explicit opt-in mechanism and is only available to
            accounts whose age has been verified as 18+. By opting in, you
            acknowledge that you are of legal age in your jurisdiction to
            access adult content.
          </p>
          <p className="text-sm">
            You may revoke your NSFW opt-in at any time from your profile
            settings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            4. Automated Moderation
          </h2>
          <p className="text-sm">
            We employ automated AI-powered moderation systems to screen
            messages, character prompts, and user-generated content for
            policy violations. This includes but is not limited to detection
            of illegal content, harassment, and attempts to de-anonymize
            users. Automated moderation runs on all messages and is performed
            server-side. You consent to this processing as a condition of use.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            5. No Media in Direct Messages
          </h2>
          <p className="text-sm">
            Direct messages (DMs) between matched users are text-only.
            Images, videos, audio, and base64-encoded data are prohibited in
            DMs. This policy is enforced both client-side and server-side.
            Attempts to bypass this restriction may result in account
            suspension.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            6. Law Enforcement Disclosure
          </h2>
          <p className="text-sm">
            We may disclose account information, including encrypted message
            content, metadata, and IP addresses, to law enforcement agencies
          </p>
          <p className="text-sm">
            in response to valid legal process (subpoenas, court orders, or
            other lawful requests). We do not warrant that encryption is
            unbreakable or that anonymization is absolute. Illegal activity
            will be reported to the appropriate authorities.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            7. Token Economy &amp; Refund Policy
          </h2>
          <p className="text-sm">
            Certain platform features consume tokens (matchmaking, AI
            roleplay, messaging). Tokens can be earned through daily
            activity, or purchased via NOWPayments cryptocurrency payments.
            VIP subscriptions provide unlimited matches and Deep Dive
            access for a 30-day period.
          </p>
          <p className="text-sm">
            <strong>Refund Policy:</strong> Token purchases are
            non-refundable once the payment is confirmed and tokens are
            credited to your account. VIP passes are non-refundable once
            activated. If a payment fails but you are charged, contact
            support with your payment ID for investigation. Refunds for
            technical failures (tokens deducted without service rendered)
            are issued at the platform&apos;s discretion as account credit.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            8. Acceptable Use
          </h2>
          <p className="text-sm">
            You agree not to: (a) attempt to de-anonymize other users, (b)
            share your account credentials, (c) use the platform for illegal
            activities, (d) attempt to bypass content moderation or payment
            systems, or (e) scrape or automate access without permission.
            Violations may result in immediate account termination.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            9. Service Availability
          </h2>
          <p className="text-sm">
            The platform is provided &quot;as is&quot; without warranty of
            availability. We do not guarantee uninterrupted service. AI
            features depend on third-party providers and may be unavailable
            without notice.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            10. Changes to Terms
          </h2>
          <p className="text-sm">
            We may update these terms at any time. Continued use after
            changes constitutes acceptance of the updated terms. Material
            changes will be announced on the platform.
          </p>
        </section>

        <div className="pt-8 border-t border-white/5">
          <Link
            href="/"
            className="text-sm text-brand-light hover:text-brand-lighter transition-colors"
          >
            &larr; Back to sweetscene
          </Link>
        </div>
      </article>
    </div>
  );
}