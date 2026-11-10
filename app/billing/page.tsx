import { getStripeBillingAvailability } from "@/lib/stripe/links";
import { isNowPaymentsConfigured } from "@/lib/nowpayments/server";
import BillingClient from "./billing-client";

/* ════════════════════════════════════════════════════════════════════
 * /billing — checkout (Phase 2: Stripe Payment Links; crypto rail
 * re-added 2026-11-11 via NOWPayments).
 *
 * Server component: reads Payment Link + NOWPayments availability from
 * env/settings (names only — values never reach the client) and hands
 * booleans to the client. Cards for unconfigured products render in a
 * "coming soon" state, and the crypto section is hidden entirely when
 * NOWPayments isn't wired up, so the page degrades gracefully on envs
 * where a rail isn't configured (see SETUP.md).
 * ════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: "Billing — SweetScene",
};

export default async function BillingPage() {
  const availability = getStripeBillingAvailability();
  const crypto = await isNowPaymentsConfigured();
  return <BillingClient availability={availability} crypto={crypto} />;
}
