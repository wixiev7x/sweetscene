import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Community",
  description: "Confessions, bounties, the leaderboard and events — the after-hours side of SweetScene.",
  path: "/community",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
