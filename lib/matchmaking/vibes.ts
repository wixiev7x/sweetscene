/** Vibe pie: 4 main moods, each with 4 sub-moods. Shared by client + server. */
export const VIBE_PIE = [
  { main: "Romance", color: "#E1245C", subs: ["Slow burn", "Forbidden", "First date", "Rivals"] },
  { main: "Fantasy", color: "#B05CFF", subs: ["Magic", "Royalty", "Vampires", "Mythic"] },
  { main: "Dark", color: "#7A1F3D", subs: ["Mystery", "Villain", "Thriller", "Horror"] },
  { main: "Adventure", color: "#D9B37A", subs: ["Sci-fi", "Pirates", "Heist", "Survival"] },
] as const;

export const ALL_VIBES: readonly string[] = VIBE_PIE.flatMap((v) => [v.main, ...v.subs]);
export const MAX_VIBES = 5;

/** Server-side: keep only known vibes, de-duplicated, capped. */
export function sanitizeVibes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const t of input) {
    if (typeof t === "string" && ALL_VIBES.includes(t) && !out.includes(t)) out.push(t);
    if (out.length >= MAX_VIBES) break;
  }
  return out;
}
