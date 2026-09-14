import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sweetscene.love";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/auth",
          "/profile",
          "/chat",
          "/dm",
          "/play",
          "/lobby",
          "/join",
          "/complete-profile",
          "/age-verify",
          "/banned",
          "/reset-password",
          "/characters/my",
          "/create-character",
          "/style-guide",
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
  };
}
