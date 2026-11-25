import { redirect } from "next/navigation";

/* The leaderboard lives on the Community page. */
export default function LeaderboardPage() {
  redirect("/community");
}
