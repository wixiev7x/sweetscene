import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Admin",
  description: "SweetScene administration.",
  path: "/admin",
  noIndex: true,
});

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
