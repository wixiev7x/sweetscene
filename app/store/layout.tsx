import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Plans & Pricing",
  description: "Free to start. Longer nights and deeper scenes when you want them. Cancel anytime, discreet billing by Paddle.",
  path: "/store",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
