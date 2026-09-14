import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Forgot Password",
  description: "Reset your SweetScene password by email.",
  path: "/forgot-password",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
