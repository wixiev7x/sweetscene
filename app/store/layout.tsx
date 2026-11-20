import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Store — VIP Pass & Token Packs",
  description: "One VIP pass, everything unlocked. Token packs for the nights ahead — pay by card or PayPal, secure checkout by Paddle.",
  path: "/store",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
