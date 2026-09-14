import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Reset Password",
  description: "Choose a new password for your account.",
  path: "/reset-password",
  noIndex: true,
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
