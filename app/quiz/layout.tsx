import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Vibe Quiz",
  description: "Five quick questions. Your answers become the vibes you match with.",
  path: "/quiz",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
