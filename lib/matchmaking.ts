export const MATCHMAKING_TIMEOUT_MS = 5 * 60 * 1000;
export const MATCHMAKING_POLL_INTERVAL_MS = 3000;

export type MatchMode = "quick" | "kink" | "blind_date";
export type MatchStatus = "idle" | "searching" | "matched" | "timeout" | "cancelled";

export interface QueueRow {
  id: string;
  user_id: string;
  kink_tags: string[];
  mode: MatchMode;
  status: "waiting" | "matched" | "cancelled" | "timeout";
  matched_with_user_id: string | null;
  matched_at: string | null;
  created_at: string;
  match_id: string | null;
}
