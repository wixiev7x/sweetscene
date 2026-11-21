/* ════════════════════════════════════════════════════════════════════
 * Subscription ladder — single source of truth for plan copy + limits.
 *
 * Matches are unlimited on every tier; tokens (which power AI replies)
 * are the metered resource. Spark refills daily; paid tiers get a
 * monthly allowance on each paid period. The only one-time purchase is
 * the "Finish the scene" quick pack, offered when a scene runs dry.
 *
 * Prices here are DISPLAY copy. The amount actually charged always
 * comes from the Paddle price id configured server-side
 * (lib/paddle/config.ts) — never from the client.
 *
 * Comparison claim: "up to 75% cheaper" = Flame $4.99 vs $19.99/mo,
 * the typical public monthly price of leading AI roleplay apps
 * (checked Nov 2026). Keep COMPARISON_NOTE accurate if prices change.
 * ════════════════════════════════════════════════════════════════════ */

export type TierId = "spark" | "ember" | "flame" | "inferno";
export type BillingPeriod = "monthly" | "yearly";

export type Tier = {
  id: TierId;
  name: string;
  tagline: string;
  monthlyUsd: number;
  /** Yearly = pay 10 months, get 12. */
  yearlyUsd: number;
  /** Tokens granted per paid month (paid tiers) or per day (Spark). */
  tokens: number;
  tokenPeriod: "day" | "month";
  perks: string[];
  highlight?: boolean;
};

export const TIERS: readonly Tier[] = [
  {
    id: "spark",
    name: "Spark",
    tagline: "Try every mode, free forever.",
    monthlyUsd: 0,
    yearlyUsd: 0,
    tokens: 1_500,
    tokenPeriod: "day",
    perks: [
      "Unlimited matches in all 4 modes",
      "1,500 free tokens, refilled daily",
      "Solo roleplay with community characters",
      "Create your own characters",
    ],
  },
  {
    id: "ember",
    name: "Ember",
    tagline: "For the nights a scene runs long.",
    monthlyUsd: 1.99,
    yearlyUsd: 19.9,
    tokens: 60_000,
    tokenPeriod: "month",
    perks: [
      "Everything in Spark",
      "60,000 tokens every month",
      "Longer scenes before the meter runs low",
      "Ember badge on your anonymous profile",
    ],
  },
  {
    id: "flame",
    name: "Flame",
    tagline: "Our most-loved plan.",
    monthlyUsd: 4.99,
    yearlyUsd: 49.9,
    tokens: 200_000,
    tokenPeriod: "month",
    highlight: true,
    perks: [
      "Everything in Ember",
      "200,000 tokens every month",
      "Deep Dive scenes with richer AI direction",
      "AI scene images",
      "Priority in the match queue",
    ],
  },
  {
    id: "inferno",
    name: "Inferno",
    tagline: "No meter anxiety. Ever.",
    monthlyUsd: 9.99,
    yearlyUsd: 99.9,
    tokens: 500_000,
    tokenPeriod: "month",
    perks: [
      "Everything in Flame",
      "500,000 tokens every month",
      "Top priority matching",
      "Early access to new modes and scenarios",
    ],
  },
] as const;

/** One-time top-up offered when a scene runs out of tokens. */
export const FINISH_THE_SCENE = {
  id: "finish_scene",
  name: "Finish the scene",
  priceUsd: 1.49,
  tokens: 8_000,
  detail: "One-time · enough to see this scene through",
} as const;

export const COMPARISON_BADGE = "Up to 75% cheaper than other AI roleplay apps";
export const COMPARISON_NOTE =
  "Compared with the typical $19.99/month public price of leading AI roleplay apps, checked November 2026. Flame is $4.99/month.";

export function getTier(id: string): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

export function formatUsd(n: number): string {
  return n === 0 ? "$0" : `$${n.toFixed(2)}`;
}
