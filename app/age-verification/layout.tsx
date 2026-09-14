import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Age Verification",
  description: "Verify your age to unlock 18+ features. We store only the result — never your ID.",
  path: "/age-verification",
  noIndex: true,
});

export default function AgeVerificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
