import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Privacy Policy",
  description:
    "How SweetScene handles your data — anonymous accounts, message encryption, age verification, payments, and your rights.",
  path: "/privacy",
});

/* Adapted from a reference privacy notice structure for SweetScene —
 * a 16+ anonymous AI matchmaking platform. Marked placeholders must be
 * confirmed by the operator before launch; lawyer review is the
 * operator's responsibility. */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-void-950 text-white">
      <div className="fixed inset-0 pointer-events-none candle-wash" />

      <article className="max-w-2xl mx-auto px-6 py-12 space-y-8 text-foreground-dim leading-relaxed">
        <h1 className="type-display text-3xl text-white tracking-wide">Privacy Policy</h1>
        <p className="type-meta text-muted">Last modified: September 10, 2026</p>

        <div className="removal-note bg-surface border-l-4 border-accent-candle/60 rounded-r p-4">
          <p className="type-meta">
            <strong className="text-foreground">NOTE:</strong> This Privacy Notice is drafted in
            English. If it is offered in any other language, the translation is for information
            purposes only and the English version prevails.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">Introduction</h2>
          <p className="type-body">
            SweetScene (hereinafter &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;) operates
            the website www.sweetscene.love (hereinafter &ldquo;SweetScene&rdquo;) and is the
            controller of the information collected or provided via SweetScene.
          </p>
          <p className="type-body">
            SweetScene is an anonymous matchmaking and AI roleplay platform. We collect as little
            identifying information as the service allows: you interact under a pseudonymous
            username, and we never ask for your real name. Please read this Privacy Notice
            carefully. If you have questions about our privacy practices, see the
            &ldquo;Contact Information&rdquo; section below.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">1. Scope</h2>
          <p className="type-body">
            &ldquo;Processing&rdquo; means any operation performed on personal data (collection,
            recording, organization, storage, adaptation, retrieval, use, blocking, deletion, or
            destruction). This Notice applies to information we process on SweetScene, including
            your communications with us via email or support channels. Information regarding data
            disclosure can be found in Section 7.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">2. Our Policy Towards Minors</h2>
          <p className="type-body">
            SweetScene is a 16+ platform. You must be at least 16 years old to create an account.
            Adult (NSFW) content is restricted to accounts verified as 18+; unverified and
            minor accounts cannot access it. Some users may be asked to complete third-party age
            verification before accessing adult content or certain features — see Section 12.
            We do not knowingly process personal information from anyone under 16. If you are the
            parent or legal guardian of a child who has provided us personal information, contact
            us at [SUPPORT EMAIL GOES HERE — CONFIRM BEFORE LAUNCH] to have that information deleted.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">3. The Data We Process About You</h2>
          <p className="type-body">
            &ldquo;Personal Data&rdquo; means any information relating to an identifiable person,
            directly or indirectly. What we process depends on how you use SweetScene.
          </p>

          <h3 className="text-base text-white font-medium mt-4">Visitors without an account</h3>
          <p className="type-body">
            You can browse characters and try a short solo scene without an account. We process:
            your IP address, browser and device information, and coarse activity data (pages
            visited, features used) for security, rate limiting, and aggregate analytics.
          </p>

          <h3 className="text-base text-white font-medium mt-4">Registered users</h3>
          <p className="type-body">
            In addition to the above, for account holders we process:
          </p>
          <ul className="list-disc pl-6 space-y-2 type-body">
            <li>
              <strong className="text-foreground">Account data:</strong> an anonymous username,
              your email address, and authentication metadata. If you register through Google or
              Discord, we receive the basic profile information those providers share.
            </li>
            <li>
              <strong className="text-foreground">Matchmaking preferences:</strong> your gender
              preference and selected &ldquo;vibes&rdquo;. These steer pairing and are never shown
              on your profile; only overlapping vibes are ever shown to a matched partner.
            </li>
            <li>
              <strong className="text-foreground">Scene and message content:</strong> the text of
              your scenes, chats, confessions, and bounty posts. Messages are encrypted at rest.
              All content passes automated moderation (Section 4 of our Terms).
            </li>
            <li>
              <strong className="text-foreground">Age and verification data:</strong> your age
              cohort (16+ / 18+) and, where you complete ID verification, only the
              provider&rsquo;s pass/fail result and a verification reference ID. We never receive
              or store ID document images or biometric data — those remain with the verification
              provider (Section 12).
            </li>
            <li>
              <strong className="text-foreground">Sensitive preferences:</strong> depending on how
              you use the platform, your NSFW opt-in status and the nature of the scenes you play
              may reveal special-category information about you.
            </li>
            <li>
              <strong className="text-foreground">Balance and payment records:</strong> your token
              balance and, for purchases, a payment reference from our crypto payment processor.
              We never see or store card numbers — checkout runs on the processor&rsquo;s hosted
              page.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">4. Sources of Personal Data</h2>
          <ul className="list-disc pl-6 space-y-2 type-body">
            <li>Directly from you — when you register, play scenes, post confessions, or contact support;</li>
            <li>Automatically as you navigate — IP address, device information, and strictly necessary cookies (Section 8);</li>
            <li>From providers you choose — Google/Discord at sign-in, and the age-verification provider&rsquo;s pass/fail result.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">5. Why We Process Your Personal Data</h2>
          <ul className="list-disc pl-6 space-y-2 type-body">
            <li><strong className="text-foreground">Providing the service:</strong> matchmaking, AI-hosted scenes, solo play, confessions, and the features you request.</li>
            <li><strong className="text-foreground">Account management:</strong> creating and securing your account, and sending you service notifications (matches, invites, purchases).</li>
            <li><strong className="text-foreground">Safety and moderation:</strong> automated screening of content, fraud and abuse prevention, enforcing the 16+/18+ age gates.</li>
            <li><strong className="text-foreground">Personalization:</strong> using your selected vibes to pair you and recommend hosts.</li>
            <li><strong className="text-foreground">Analytics and improvement:</strong> aggregate, anonymized metrics on feature use.</li>
            <li><strong className="text-foreground">Payments:</strong> processing token pack and VIP purchases through our crypto payment processor.</li>
            <li><strong className="text-foreground">Legal compliance and law-enforcement requests:</strong> as described in Section 7.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            6. Our Legal Bases under Canadian, UK and European Union (EU) Privacy Law
          </h2>
          <p className="type-body">Where required by applicable law, we process personal data only when:</p>
          <ul className="list-disc pl-6 space-y-2 type-body">
            <li>You consent — for example to NSFW opt-in or biometric processing by the verification provider. Consent can be withdrawn at any time.</li>
            <li>It is necessary to perform our contract with you — for example to create and operate your account.</li>
            <li>It is necessary to comply with legal obligations.</li>
            <li>It satisfies a legitimate interest not overridden by your data-protection interests — for example keeping SweetScene safe from fraud and illegal activity.</li>
            <li>It protects your or others&rsquo; vital interests, or is carried out in the public interest.</li>
          </ul>
          <p className="type-body">
            If you reside outside the EEA, Switzerland, or the UK, the legal bases we rely on may
            differ.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">7. Disclosure of Your Personal Information</h2>
          <p className="type-body">We disclose personal information to:</p>
          <ul className="list-disc pl-6 space-y-2 type-body">
            <li><strong className="text-foreground">The community, by design:</strong> your anonymous username, public confessions, and bounty posts are visible to other users. Nothing on your profile reveals your identity.</li>
            <li><strong className="text-foreground">Service providers:</strong> hosting and database (Vercel, Supabase), AI text generation (DeepSeek), optional image generation (Google Gemini), crypto payment processing (NOWPayments), bot protection (Cloudflare Turnstile), rate limiting (Upstash), and the age-verification provider. Providers process data only on our instructions under data-processing agreements where required.</li>
            <li><strong className="text-foreground">Sign-in providers:</strong> Google and Discord, when you choose them — their own policies govern those services.</li>
            <li><strong className="text-foreground">Legal successors:</strong> in a merger, acquisition, or sale of assets.</li>
            <li><strong className="text-foreground">Authorities:</strong> regulators, public authorities, and law enforcement where we reasonably believe disclosure is required to comply with law, enforce our Terms (including safety enforcement), detect or prevent illegal activity, or protect the rights, property, or safety of our users or others.</li>
          </ul>
          <p className="type-body">
            Disclosures may involve transfers outside the EEA; Section 13 explains the safeguards
            we rely on.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">8. Cookies and Automatic Data Collection</h2>
          <p className="type-body">
            SweetScene sets only strictly necessary cookies and local storage: your authentication
            session and your &ldquo;remember me&rdquo; preference. We do not use advertising,
            tracking, or cross-site cookies, and we do not sell data to advertisers. You can clear
            or block cookies in your browser settings; blocking session cookies will sign you out.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">9. Your Choices</h2>
          <ul className="list-disc pl-6 space-y-2 type-body">
            <li>Remain anonymous: we never ask for your real name or face; profile pictures are optional generated/anonymous art.</li>
            <li>Turn NSFW content on or off from your profile at any time.</li>
            <li>Revoke matchmaking preferences at any time — they only live for the current pairing.</li>
            <li>Delete your account from your profile page; this removes access to your content and starts deletion of your account data.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">10. California Rights and Choices</h2>
          <p className="type-body">
            California residents have rights under the CCPA as amended by the CPRA, including the
            right to know what personal information is collected, to request deletion, to opt out
            of any &ldquo;sale&rdquo; of personal information, and to not be discriminated against
            for exercising these rights. SweetScene does not sell personal information for
            monetary or other valuable consideration. To exercise these rights, contact
            [SUPPORT EMAIL GOES HERE — CONFIRM BEFORE LAUNCH] with the subject line
            &ldquo;CCPA Request&rdquo; from the email on your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">
            11. Residents&rsquo; Rights — Other United States Jurisdictions
          </h2>
          <p className="type-body">
            We do not sell or trade registered users&rsquo; personal information. Residents of
            other US states with applicable privacy laws may contact us to exercise equivalent
            rights.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">12. Age Verification and Biometric Information</h2>
          <p className="type-body">
            Where required — to access NSFW content or certain gated features — age and identity
            verification is performed by an independent third-party provider. Depending on the
            provider, verification may involve government-issued ID and facial-recognition
            technology. That process runs entirely on the provider&rsquo;s infrastructure:
            <strong className="text-foreground">
              {" "}we receive only a pass/fail result and a verification reference ID
            </strong>
            . We never receive, process, or store ID document images or biometric data. The
            provider&rsquo;s own privacy notice governs that processing — read it before
            verifying.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">13. Transfers of Your Personal Information</h2>
          <p className="type-body">
            Our service providers may operate outside the EEA and the UK. Where personal
            information is transferred to countries without comprehensive data-protection law, we
            rely on European Commission adequacy decisions or standard contractual clauses (and
            the UK equivalents), or on derogations provided under applicable law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">14. Retention of Personal Information</h2>
          <p className="type-body">
            We retain personal information while your account is active, and afterwards only as
            long as necessary for the purposes processed — including legal, accounting, and
            moderation requirements. Message content is stored encrypted at rest for the lifetime
            of the match or scene and deleted with it. Where we no longer need information, we
            delete it, and we delete account data upon a verified deletion request (some data may
            be retained to meet legal obligations).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">15. Third-Party Links and Sites</h2>
          <p className="type-body">
            The verification flow and payment checkout run on third-party infrastructure, and
            characters or confessions may link elsewhere. This Notice does not apply to those
            services; their own privacy notices govern.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">16. Changes to Our Privacy Notice</h2>
          <p className="type-body">
            We keep this Notice under review and may update it for new legal requirements or
            features. The &ldquo;Last modified&rdquo; date above reflects the current version;
            material changes will be announced on the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">17. Your Rights Related to Your Personal Information</h2>
          <p className="type-body">Subject to applicable law and exemptions, you have the right to:</p>
          <ul className="list-disc pl-6 space-y-2 type-body">
            <li>Access the personal data we hold about you;</li>
            <li>Rectify inaccurate data;</li>
            <li>Delete your personal data (right to be forgotten);</li>
            <li>Receive your data in a portable format;</li>
            <li>Object to or restrict processing based on legitimate interests;</li>
            <li>Withdraw consent for consent-based processing at any time;</li>
            <li>File a complaint with your local data-protection authority if you are in the EEA or UK.</li>
          </ul>
          <p className="type-body">
            To exercise any right, contact [SUPPORT EMAIL GOES HERE — CONFIRM BEFORE LAUNCH]. We
            respond within one month. We may need to verify your identity through your account
            before acting. Note that some deletion requests require deleting your account, since
            the account itself is built on the data in question.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl text-white font-medium">18. Contact Information</h2>
          <p className="type-body">
            If you have any questions about this Privacy Notice or our information-handling
            practices, please contact us at [SUPPORT EMAIL GOES HERE — CONFIRM BEFORE LAUNCH].
          </p>
        </section>

        <div className="pt-8 border-t border-white/5">
          <Link
            href="/"
            className="type-body text-brand-light hover:text-brand-lighter transition-colors"
          >
            &larr; Back to SweetScene
          </Link>
        </div>
      </article>
    </div>
  );
}
