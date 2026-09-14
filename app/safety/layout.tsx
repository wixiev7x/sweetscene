import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Safety",
  description: "Consent, anonymity, blocking, reporting and age guidance — how SweetScene stays safe.",
  path: "/safety",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
