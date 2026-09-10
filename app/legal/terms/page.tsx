import { redirect } from "next/navigation";

/* The terms of service live at /terms. This legacy path keeps old
 * links working. */
export default function LegalTermsPage() {
  redirect("/terms");
}
