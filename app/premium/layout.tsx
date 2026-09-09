import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "The VIP Pass",
  description: "Unlimited matches, Deep Dive scenes, NSFW creation and AI image generation. One pass, 30 days.",
  path: "/premium",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
