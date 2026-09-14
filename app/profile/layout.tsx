import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Profile",
  description: "Your anonymous profile, balance and account controls.",
  path: "/profile",
  noIndex: true,
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
