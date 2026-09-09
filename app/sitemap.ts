import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sweetscene.love";
  const now = new Date();
  const publicRoutes: { path: string; priority: number }[] = [
    { path: "/", priority: 1 },
    { path: "/matchmake", priority: 0.9 },
    { path: "/scenarios", priority: 0.8 },
    { path: "/explore", priority: 0.8 },
    { path: "/characters", priority: 0.8 },
    { path: "/community", priority: 0.7 },
    { path: "/confessions", priority: 0.7 },
    { path: "/store", priority: 0.7 },
    { path: "/premium", priority: 0.7 },
    { path: "/bounties", priority: 0.6 },
    { path: "/leaderboard", priority: 0.6 },
    { path: "/events", priority: 0.6 },
    { path: "/trending", priority: 0.5 },
    { path: "/achievements", priority: 0.5 },
    { path: "/quiz", priority: 0.6 },
    { path: "/how", priority: 0.6 },
    { path: "/safety", priority: 0.6 },
    { path: "/create", priority: 0.6 },
    { path: "/signup", priority: 0.5 },
    { path: "/login", priority: 0.4 },
    { path: "/legal/terms", priority: 0.3 },
    { path: "/legal/privacy", priority: 0.3 },
  ];
  return publicRoutes.map((r) => ({
    url: `${site}${r.path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: r.priority,
  }));
}
