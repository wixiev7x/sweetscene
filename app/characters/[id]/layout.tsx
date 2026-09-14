import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Character Profile",
  description: "A SweetScene character — personality, scenario tags, and how to play.",
  path: "/characters",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
