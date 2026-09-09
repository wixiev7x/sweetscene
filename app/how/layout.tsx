import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "How SweetScene Works",
  description: "Match first, build connection in an AI-guided scene, and reveal only when you both agree.",
  path: "/how",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
