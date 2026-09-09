import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Sign In",
  description: "Welcome back to the scene. Sign in with Google, Discord, or email.",
  path: "/login",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
