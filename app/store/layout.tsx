import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Plans & Pricing",
  description: "Free forever, or longer scenes from $1.99/month, up to 75% cheaper than other AI roleplay apps. Cancel anytime. Secure checkout by Paddle.",
  path: "/store",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
