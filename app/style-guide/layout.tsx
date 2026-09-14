import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Style Guide",
  description: "The SweetScene design system reference.",
  path: "/style-guide",
  noIndex: true,
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
