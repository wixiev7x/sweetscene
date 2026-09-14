import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Age Confirmation",
  description: "Confirm you're old enough for this part of the scene.",
  path: "/age-verify",
  noIndex: true,
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
