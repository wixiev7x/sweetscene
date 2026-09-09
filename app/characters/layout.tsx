import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Browse Characters",
  description: "Every character on SweetScene — browse, filter, and find your host.",
  path: "/characters",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
