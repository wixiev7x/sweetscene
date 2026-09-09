import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Explore Characters",
  description: "Discover AI hosts created by the community and start a scene tonight.",
  path: "/explore",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
