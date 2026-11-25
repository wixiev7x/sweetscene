/* Scenario library. Each maps to vibe tags so a scenario starts a
 * By Vibe match with people who picked the same mood. Adult scenarios
 * are only shown to opted-in adults (and never while SFW_MODE is on). */

export type Scenario = {
  slug: string;
  title: string;
  hook: string;
  setting: string;
  vibes: string[]; // must be ALL_VIBES members
  adult?: boolean;
  tint: string;
};

export const SCENARIOS: Scenario[] = [
  { slug: "midnight-train", title: "The Midnight Train", hook: "Six hours, one sealed compartment, and a stranger who won't stop looking at you.", setting: "Night train, sealed compartment", vibes: ["Mystery", "Slow burn"], tint: "rgba(80,90,200,.45)" },
  { slug: "masquerade", title: "Masquerade", hook: "Masks on. Names off. One dance before midnight changes everything.", setting: "Candlelit ballroom", vibes: ["Romance", "Royalty"], tint: "rgba(217,179,122,.45)" },
  { slug: "rivals", title: "Office Rivals", hook: "You've fought all year. Now you're the last two left on the floor.", setting: "Empty office after hours", vibes: ["Rivals", "Slow burn"], tint: "rgba(225,36,92,.4)" },
  { slug: "vampire-court", title: "The Vampire Court", hook: "You were invited as dinner. They're starting to like you too much.", setting: "Gothic manor", vibes: ["Vampires", "Dark"], tint: "rgba(122,31,61,.7)" },
  { slug: "heist", title: "The Last Heist", hook: "One vault, one partner you've never met, and twelve minutes.", setting: "Casino vault", vibes: ["Heist", "Thriller"], tint: "rgba(45,212,191,.3)" },
  { slug: "first-date", title: "Blind First Date", hook: "Rain, a tiny café, and the wrong table on purpose.", setting: "Rainy café", vibes: ["First date", "Romance"], tint: "rgba(255,92,135,.35)" },
  { slug: "space-station", title: "Orbit Lockdown", hook: "The station sealed itself. The two of you are all that's left awake.", setting: "Space station, emergency lights", vibes: ["Sci-fi", "Survival"], tint: "rgba(61,169,252,.35)" },
  { slug: "pirate-captain", title: "Captain's Prize", hook: "You stowed away. The captain found you. Now you work for them.", setting: "Pirate ship at dusk", vibes: ["Pirates", "Adventure"], tint: "rgba(217,140,80,.4)" },
  { slug: "forbidden-tutor", title: "Forbidden Lessons", hook: "Private lessons, a locked door, and a line you both keep almost crossing.", setting: "Late-night study", vibes: ["Forbidden", "Slow burn"], adult: true, tint: "rgba(225,36,92,.55)" },
  { slug: "villain-captive", title: "The Villain's Guest", hook: "They caught you. They could let you go. They'd rather keep you.", setting: "Penthouse lair", vibes: ["Villain", "Dark"], adult: true, tint: "rgba(90,10,40,.8)" },
  { slug: "hotel-room", title: "Room 1408", hook: "Wrong key card, right stranger. Neither of you leaves.", setting: "Luxury hotel suite", vibes: ["Forbidden", "Romance"], adult: true, tint: "rgba(176,92,255,.45)" },
  { slug: "summoning", title: "Wrong Summoning", hook: "The spell was meant for a familiar. It summoned something far more tempting.", setting: "Witch's tower", vibes: ["Magic", "Mythic"], adult: true, tint: "rgba(176,92,255,.5)" },
];

export function visibleScenarios(adult: boolean) {
  return SCENARIOS.filter((s) => adult || !s.adult);
}
