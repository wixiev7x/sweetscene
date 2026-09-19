import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Checkout",
  description: "Choose your plan and payment method — card, PayPal, bank, or crypto.",
  path: "/checkout",
  noIndex: true,
});

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
