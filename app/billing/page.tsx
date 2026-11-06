import Link from "next/link";

/* ════════════════════════════════════════════════════════════════════
 * /billing — Phase 1 placeholder.
 *
 * The legacy card/crypto payment rails were removed in Phase 1 of
 * the payment consolidation — see deploy-guide/ for the removal
 * record. Stripe
 * Link checkout (VIP + token packs) lands on this page in Phase 2;
 * until then this page explains the pause. Static, no data deps.
 * ════════════════════════════════════════════════════════════════════ */
export default function BillingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 py-8">
      <div className="max-w-2xl mx-auto text-center">
        <p className="type-eyebrow text-accent-candle mb-2">Billing</p>
        <h1 className="type-display text-3xl sm:text-4xl mb-4">
          Card checkout is <span className="gradient-text">almost back.</span>
        </h1>
        <p className="type-body text-muted mb-2">
          We are switching to a new card processor, so purchases are
          temporarily unavailable. Your token balance and any active VIP
          time are exactly as they were — nothing is affected.
        </p>
        <p className="type-body text-muted mb-8">
          Card, Apple Pay and Google Pay will return here shortly.
        </p>
        <Link
          href="/store"
          data-cursor="primary"
          className="inline-flex h-11 items-center rounded-full bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-light px-8 text-sm font-semibold text-accent-foreground ios-press shadow-lg shadow-brand/20 focus-visible:ring-2 ring-line-focus focus-visible:outline-none"
        >
          Back to the store
        </Link>
      </div>
    </div>
  );
}
