import { redirect } from "next/navigation";

/* Pricing lives in one place: the Store. This route keeps old links
 * working instead of maintaining a second price list that can drift. */
export default function PricingPage() {
  redirect("/store");
}
