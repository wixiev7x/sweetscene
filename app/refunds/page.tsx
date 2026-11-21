import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import LegalLayout, { SUPPORT_EMAIL, type LegalSection } from "@/components/legal/LegalLayout";

export const metadata: Metadata = pageMeta({
  title: "Refund Policy",
  description:
    "How cancellations and refunds work for SweetScene subscriptions and one-time token packs.",
  path: "/refunds",
});

const sections: LegalSection[] = [
  {
    id: "summary",
    title: "Summary",
    body: (
      <ul>
        <li>Cancel any subscription at any time — you keep your plan until the end of the period you paid for.</li>
        <li>New subscriptions can be refunded within <strong>14 days</strong> of purchase.</li>
        <li>Renewals can be refunded within <strong>48 hours</strong> if you forgot to cancel and haven&rsquo;t used the new period&rsquo;s tokens.</li>
        <li>One-time &ldquo;Finish the scene&rdquo; packs can be refunded within 14 days if the tokens are unused.</li>
      </ul>
    ),
  },
  {
    id: "cancel",
    title: "Cancelling a subscription",
    body: (
      <p>
        Open <Link href="/billing">Billing</Link> and choose <strong>Manage subscription</strong>, or use the link in any
        receipt email from Paddle. Cancelling stops future renewals; it does not end your current paid period early, and
        your remaining tokens stay usable until that period ends.
      </p>
    ),
  },
  {
    id: "eligible",
    title: "Refund eligibility",
    body: (
      <>
        <p>We will refund your payment in full when you ask within these windows:</p>
        <table>
          <thead>
            <tr><th>Purchase</th><th>Window</th><th>Condition</th></tr>
          </thead>
          <tbody>
            <tr><td>First payment of a subscription</td><td>14 days</td><td>No condition</td></tr>
            <tr><td>Subscription renewal</td><td>48 hours</td><td>New period&rsquo;s tokens unused</td></tr>
            <tr><td>Finish the scene pack</td><td>14 days</td><td>Tokens unused</td></tr>
          </tbody>
        </table>
        <p>
          We also refund any payment that was charged in error, charged twice, or charged for a plan you could not use
          because of a fault on our side. If you live somewhere that gives you additional rights as a consumer, nothing
          in this policy limits them.
        </p>
      </>
    ),
  },
  {
    id: "not-eligible",
    title: "When refunds aren't available",
    body: (
      <p>
        Outside the windows above, payments are generally non-refundable, including partial periods after cancellation
        and tokens that have already been used. Accounts banned for breaking our <Link href="/terms">Terms</Link> are not
        eligible for refunds of the current period.
      </p>
    ),
  },
  {
    id: "how",
    title: "How to request a refund",
    body: (
      <>
        <p>
          All purchases are processed by <strong>Paddle.com</strong>, our Merchant of Record. To request a refund, either:
        </p>
        <ol>
          <li>reply to your Paddle receipt email, or visit <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a> and look up your order; or</li>
          <li>email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the address on your account with your order number.</li>
        </ol>
        <p>
          Approved refunds go back to your original payment method, usually within 5–10 business days depending on your
          bank. Tokens from a refunded purchase are removed from your balance.
        </p>
      </>
    ),
  },
];

export default function RefundsPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Refund Policy"
      current="/refunds"
      intro={<p>Fair and simple: cancel whenever you like, and if a purchase didn&rsquo;t work out, ask within the windows below.</p>}
      sections={sections}
    />
  );
}
