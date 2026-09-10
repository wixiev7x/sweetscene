import { redirect } from "next/navigation";

/* The privacy policy lives at /privacy. This legacy path keeps old
 * links working. */
export default function LegalPrivacyPage() {
  redirect("/privacy");
}
