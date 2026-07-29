import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /* D4: hide X-Powered-By header to reduce fingerprinting. */
  poweredByHeader: false,
  /* D4: surface side-effect bugs early in development. */
  reactStrictMode: true,
  /* Next walks upward looking for a lockfile to decide the workspace root.
     An unrelated package-lock.json in the home directory wins that search
     and silently moves the root outside the project, which changes what
     file tracing bundles. Pin it. */
  turbopack: { root: path.resolve(process.cwd()) },
};

export default nextConfig;
