import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "sweetscene — anonymous AI roleplay dating",
    short_name: "sweetscene",
    description:
      "Match anonymously, roleplay inside a shared scene with an AI director, and decide if the fog lifts. 16+.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#a855f7",
    orientation: "portrait",
    categories: ["social", "entertainment", "lifestyle"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}