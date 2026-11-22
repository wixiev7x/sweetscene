"use server";

import { fetchFeed, parseAudience, parseMood, parseSort, viewerCanSeeAdult, type FeedCharacter } from "@/lib/home/feed";

/** Infinite-scroll page for the homepage grid. All inputs are re-validated. */
export async function loadHomeFeed(input: {
  audience?: string;
  sort?: string;
  mood?: string | null;
  offset?: number;
}): Promise<FeedCharacter[]> {
  const offset = Number.isInteger(input.offset) && (input.offset as number) >= 0 ? Math.min(input.offset as number, 2000) : 0;
  const adult = await viewerCanSeeAdult();
  return fetchFeed({
    audience: parseAudience(input.audience),
    sort: parseSort(input.sort),
    mood: parseMood(input.mood ?? null, adult),
    offset,
    adult,
  });
}
