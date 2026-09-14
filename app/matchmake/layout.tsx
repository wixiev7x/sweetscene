import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Matchmake — Four Ways Into a Scene",
  description: "Quick Match by preference, By Vibe, Blind Date, or a private Invite Room. Anonymous matchmaking — reveal only when both sides agree.",
  path: "/matchmake",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
