import { redirect } from "next/navigation";

/* Plans live in one place: the Store. Keeps old /premium links working. */
export default function PremiumPage() {
  redirect("/store");
}
