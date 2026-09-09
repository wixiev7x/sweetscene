import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Confessions — After Hours",
  description: "Anonymous stories from the scene. No names, no faces — just what happened.",
  path: "/confessions",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
