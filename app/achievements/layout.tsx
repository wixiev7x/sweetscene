import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Achievements",
  description: "Milestones and marks earned across the scene.",
  path: "/achievements",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
