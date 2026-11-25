import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Scenarios",
  description: "Pick a story and get matched with a stranger who wants to play it too. Romance, fantasy, dark and adventure scenarios.",
  path: "/scenarios",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
