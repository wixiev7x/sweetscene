import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Fresh from the Scene",
  description: "The newest characters, confessions and climbs across SweetScene.",
  path: "/trending",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
