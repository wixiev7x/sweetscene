import Link from "next/link";

/**
 * Privacy Policy page. Covers data collection (account metadata, message
 * content, IP), encryption at rest, automated AI moderation, data
 * retention, law-enforcement disclosure, and user rights. Not legal
 * advice — have a lawyer review before launch.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-void-950 text-white">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,45,149,0.08)_0%,transparent_50%)]" />

      <nav className="sticky top-0 z-10 border-b border-white/5 backdrop-blur-md bg-void-950/40 px-6 py-4">
        <Link
          href="/"
          className="text-xl font-bold text-brand-light hover:text-brand-lighter transition-colors"
        >
          sweetscene
        </Link>
      </nav>

      <article className="max-w-2xl mx-auto px-6 py-12 space-y-8 text-foreground-dim leading-relaxed">
        <h1 className="text-3xl font-light text-white tracking-wide">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted">
          Last updated: 2026
        </p>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            1. Data We Collect
          </h2>
          <ul className="text-sm space-y-2 list-disc list-inside">
            <li>
              <strong>Account data:</strong> Email address, OAuth provider
              ID (Google/Discord), anonymous username, anonymous avatar URL.
            </li>
            <li>
              <strong>Message content:</strong> All messages sent in matches
              and solo sessions. Match chat messages are encrypted at rest
              using AES-256-GCM. Solo session messages are stored as
              plaintext (they are private to you and the AI).
            </li>
            <li>
              <strong>Usage metadata:</strong> IP address, device type,
              timestamps, match history, token transactions, payment
              records.
            </li>
            <li>
              <strong>Content you create:</strong> Character prompts,
              personality traits, greetings, and ratings you submit.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            2. Message Encryption
          </h2>
          <p className="text-sm">
            Match chat messages between users are encrypted at rest using
            AES-256-GCM symmetric encryption. The encryption key is stored
            server-side and is not accessible to the client. We retain the
            ability to decrypt messages for moderation and legal compliance
            purposes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            3. Automated AI Moderation
          </h2>
          <p className="text-sm">
            All messages and user-generated content are processed by
            automated AI moderation systems to detect policy violations.
            This processing happens server-side before content is stored or
            delivered. The AI moderation may flag, block, or report content
            without human review. Flagged content may be reviewed by human
            moderators.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            4. Anonymization
          </h2>
          <p className="text-sm">
            Other users cannot see your real identity. Your OAuth email,
            provider ID, and IP address are never displayed to other users.
            Partner UUIDs in match views are hashed (SHA-256) to prevent
            cross-referencing. However, true anonymization cannot be
            guaranteed if you voluntarily share identifying information in
            messages.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            5. Data Retention
          </h2>
          {/* A <ul> is not valid inside a <p> — the browser closes the
              paragraph before the list, so the text-sm never applied to
              the items and a stray </p> was emitted. The class moves to
              the list itself. */}
          <ul className="text-sm space-y-2 list-disc list-inside">
              <li>
                <strong>Account data:</strong> Retained until account
                deletion.
              </li>
              <li>
                <strong>Match messages:</strong> Retained for the duration
                of the match and 90 days after the match ends.
              </li>
              <li>
                <strong>Solo session messages:</strong> Retained until you
                delete the session or your account.
              </li>
              <li>
                <strong>Payment records:</strong> Retained for 7 years for
                tax and legal compliance.
              </li>
              <li>
                <strong>Reports:</strong> Retained for 1 year after
                resolution.
              </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            6. Law Enforcement Disclosure
          </h2>
          <p className="text-sm">
            We may disclose account information, including decrypted message
            content, metadata, and IP addresses, to law enforcement in
            response to valid legal process. We do not provide backdoor
            access. All disclosures are logged.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            7. Third-Party Services
          </h2>
          <ul className="text-sm space-y-2 list-disc list-inside">
            <li>
              <strong>Supabase:</strong> Database, authentication, and
              real-time infrastructure.
            </li>
            <li>
              <strong>Google / Discord:</strong> OAuth authentication
              providers.
            </li>
            <li>
              <strong>DeepSeek / Google Gemini:</strong> AI content
              generation.
            </li>
            <li>
              <strong>NOWPayments:</strong> Cryptocurrency payment
              processing.
            </li>
            <li>
              <strong>Cloudflare:</strong> DDoS protection and bot
              mitigation (Turnstile).
            </li>
          </ul>
          <p className="text-sm">
            Each third-party service has its own privacy policy. We share
            only the minimum data necessary to provide the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            8. Your Rights
          </h2>
          <ul className="text-sm space-y-2 list-disc list-inside">
            <li>
              <strong>Access:</strong> You can view your data via your
              profile page.
            </li>
            <li>
              <strong>Deletion:</strong> You can delete your account, which
              cascades to all associated data (messages, characters,
              sessions).
            </li>
            <li>
              <strong>NSFW opt-out:</strong> You can revoke NSFW opt-in at
              any time from your profile settings.
            </li>
            <li>
              <strong>Data export:</strong> Contact support to request a
              data export.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            9. Children&apos;s Privacy
          </h2>
          <p className="text-sm">
            The platform is not directed at children under 13. Users under
            13 are not permitted. Users aged 13–17 are classified as minors
            and cannot access NSFW content. We do not knowingly collect data
            from children under 13. If you believe a child under 13 has
            registered, contact support for immediate removal.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            10. Changes to This Policy
          </h2>
          <p className="text-sm">
            We may update this Privacy Policy at any time. Material changes
            will be announced on the platform. Continued use after changes
            constitutes acceptance.
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