import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Creator Leaderboard",
  description: "Top scene-builders, ranked by reputation earned in play.",
  path: "/leaderboard",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
