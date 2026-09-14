import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "sweetscene — anonymous AI roleplay dating",
    short_name: "sweetscene",
    description:
      "Match anonymously, roleplay inside a shared scene with an AI director, and decide if the fog lifts. 16+.",
    start_url: "/",
    display: "standalone",
    background_color: "#150f1d",
    theme_color: "#150f1d",
    orientation: "portrait",
    categories: ["social", "entertainment", "lifestyle"],
    icons: [
      { src: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      {
        src: "/favicon-32.png",
        sizes: "32x32",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}