import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Bounties — Scene Requests",
  description: "Post the scene you're looking for — or build one someone else is wishing for.",
  path: "/bounties",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
