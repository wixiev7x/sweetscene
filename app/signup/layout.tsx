import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Create Your Identity",
  description: "Join SweetScene — anonymous AI matchmaking. No faces, no names, just vibes.",
  path: "/signup",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
