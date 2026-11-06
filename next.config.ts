import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: path.resolve(process.cwd()) },
  redirects: async () => [
    /* Phase 1: the legacy /checkout page (removed together with the
     * old payment rails) redirects to /billing, which becomes the
     * single billing surface once Stripe Link lands in Phase 2. */
    { source: "/checkout", destination: "/billing", permanent: false },
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "image.pollinations.ai" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
