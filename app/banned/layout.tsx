import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Account Suspended",
  description: "Your SweetScene account is currently restricted.",
  path: "/banned",
  noIndex: true,
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
