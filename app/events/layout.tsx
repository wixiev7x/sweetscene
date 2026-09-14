import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Events",
  description: "What's happening on SweetScene — runs, challenges and community nights.",
  path: "/events",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
