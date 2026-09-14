import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Scenarios — The Scene Book",
  description: "Cinematic openers for solo roleplay — moods, settings, opening lines, and an AI host to run the scene.",
  path: "/scenarios",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
