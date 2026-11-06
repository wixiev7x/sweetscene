import { getStripeBillingAvailability } from "@/lib/stripe/links";
import BillingClient from "./billing-client";

/* ════════════════════════════════════════════════════════════════════
 * /billing — card checkout (Phase 2: Stripe Payment Links).
 *
 * Server component: reads Payment Link availability from env (names
 * only — values never reach the client) and hands a boolean map to
 * the client. Cards for unconfigured products render in a
 * "coming soon" state, so the page degrades gracefully on envs where
 * Stripe isn't wired up yet (see SETUP.md).
 * ════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: "Billing — SweetScene",
};

export default function BillingPage() {
  const availability = getStripeBillingAvailability();
  return <BillingClient availability={availability} />;
}
