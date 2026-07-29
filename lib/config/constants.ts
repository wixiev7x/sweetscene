/**
 * Shared constants for the sweetscene platform.
 *
 * Extracted to a single source-of-truth file so server actions and
 * client components reference the same values (L15/L16).
 */

/* ── Age policy ──
 *
 * Two distinct thresholds. Do not collapse them:
 *   MIN_PLATFORM_AGE — floor to hold an account at all.
 *   ADULT_AGE        — floor for NSFW opt-in. Enforced server-side in
 *                      `set_nsfw_opt_in`, which requires age_cohort='adult'.
 *
 * age_cohort is derived from a birthdate SERVER-SIDE (see
 * `set_own_age_cohort` in schema.sql) and is write-once. It must never
 * be derived from a client-supplied value.
 */
export const MIN_PLATFORM_AGE = 16;
export const ADULT_AGE = 18;

/* ── Match tiers ── */
export const MATCH_TIERS = ["quick", "deep"] as const;
export type MatchTier = (typeof MATCH_TIERS)[number];

/* Token pool deducted per match tier. */
export const QUICK_MATCH_POOL = 2_000;
export const DEEP_MATCH_POOL = 10_000;

export function poolForTier(tier: MatchTier): number {
  return tier === "quick" ? QUICK_MATCH_POOL : DEEP_MATCH_POOL;
}

/* ── Free-tier limits ── */
export const FREE_TIER_DAILY_MATCH_CAP = 3;

/* ──── Message limits ── */
export const MESSAGE_MAX_LENGTH = 500;
export const MESSAGE_TOKEN_COST = 20;
export const WAITING_ROOM_MESSAGE_CAP = 30;
export const SOLO_MESSAGE_CAP = 50;

/* ── Token budget displayed on the solo play page ── */
export const SOLO_TOKEN_BUDGET = 5_000;

/* ── Scenario tags ── */

/**
 * Canonical validated tags for matchmaking. Tags not in this set are
 * rejected before being interpolated into a PostgREST filter (M3).
 */
export const VALID_SCENARIO_TAGS = [
  "hospital",
  "coffee_shop",
  "mansion",
  "library",
  "gym",
  "noir_office",
  "restaurant",
  "fitness",
  "clinic",
  "home",
  "service",
  "mystery",
] as const;

/**
 * Extended tag set for imported character cards. Includes common
 * aliases that the canonical set does not cover.
 */
export const KNOWN_SCENARIO_TAGS = [
  ...VALID_SCENARIO_TAGS,
  "noir",
  "school",
  "cafe",
  "kitchen",
  "office",
] as const;

export const VALID_SCENARIO_TAG_SET = new Set<string>(VALID_SCENARIO_TAGS);
export const KNOWN_SCENARIO_TAG_SET = new Set<string>(KNOWN_SCENARIO_TAGS);

/* ── AI config defaults ── */
export const AI_MAX_TOKENS = 200;
export const AI_TEMPERATURE = 0.9;
export const AI_FETCH_TIMEOUT_MS = 30_000;
export const AI_CONTEXT_WINDOW = 20;
export const AI_SUMMARY_INTERVAL = 10;

/* ── Pagination ── */
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

/* ── Username constraints ── */
export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 20;
/**
 * Account deletion confirmation phrase. The user types it exactly, which
 * guards against a mis-click and against a forged call in equal measure.
 *
 * Lives here rather than in lib/actions/profile.ts because a
 * "use server" file may only export async functions — a plain const
 * export there is a build error.
 */
export const DELETE_CONFIRMATION = "DELETE MY ACCOUNT";
