import { getPaddleClientToken, paddleEnv } from "@/lib/paddle/config";
import CheckoutClient from "./checkout-client";

/* ════════════════════════════════════════════════════════════════════
 * /checkout — Paddle "default payment link".
 *
 * Paddle transaction checkout URLs point here with `?_ptxn=txn_…`.
 * Paddle.js, once initialised, opens the overlay for that transaction
 * automatically. Token + environment are read server-side at request
 * time and passed down — nothing is hardcoded or build-time inlined.
 * ════════════════════════════════════════════════════════════════════ */

export const metadata = { title: "Checkout, SweetScene" };
export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return <CheckoutClient token={getPaddleClientToken()} env={paddleEnv()} />;
}
