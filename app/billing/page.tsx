import { getPaddleBillingAvailability } from "@/lib/paddle/config";
import { isNowPaymentsConfigured } from "@/lib/nowpayments/server";
import BillingClient from "./billing-client";

/* ════════════════════════════════════════════════════════════════════
 * /billing — checkout (Paddle Billing; crypto rail
 * re-added 2026-11-11 via NOWPayments).
 *
 * Server component: reads Payment Link + NOWPayments availability from
 * env/settings (names only — values never reach the client) and hands
 * booleans to the client. Cards for unconfigured products render in a
 * "coming soon" state, and the crypto section is hidden entirely when
 * NOWPayments isn't wired up, so the page degrades gracefully on envs
 * where a rail isn't configured (see SETUP.md).
 * ════════════════════════════════════════════════════════════════════ */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Billing — SweetScene",
};

export default async function BillingPage() {
  const availability = getPaddleBillingAvailability();
  const crypto = await isNowPaymentsConfigured();
  return <BillingClient availability={availability} crypto={crypto} />;
}
