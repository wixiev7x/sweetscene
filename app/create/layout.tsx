import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Create a Character",
  description: "Design an AI host for the community — name, personality, opening line, artwork.",
  path: "/create",
});

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
