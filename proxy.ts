import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy (Next 16 successor to middleware.ts). Redirects unauthenticated
 * users away from protected routes to /login. This is an *optimistic*
 * check against the Supabase auth cookie name — real authorization still
 * happens in each Server Action and via RLS. Public routes are /, /login,
 * /auth and their subpaths.
 *
 * Phase 5b:
 *   - S9: security headers added to every response (CSP, Referrer-Policy,
 *     X-Content-Type-Options, Permissions-Policy, HSTS in production).
 *
 * Note: Supabase SSR stores the auth token under a cookie named like
 * `sb-<project-ref>-auth-token`. We detect any cookie starting with
 * `sb-` and containing `-auth-token` as a sign of an active session.
 *
 * IMPORTANT (from the Next 16 proxy.md doc): Server Functions are NOT
 * separate routes — a matcher that excludes a path also excludes their
 * POST calls. Always verify auth inside each Server Function rather than
 * relying on proxy alone.
 */

const PROTECTED_PREFIXES = [
  "/lobby",
  "/chat",
  "/dm",
  "/play",
  "/characters",
  "/create-character",
  "/profile",
];

function hasSessionCookie(req: NextRequest): boolean {
  const cookies = req.cookies.getAll();
  return cookies.some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );
}

/**
 * Builds the security headers that every response should carry (S9).
 * Set on the response going downstream to the client.
 */
function withSecurityHeaders(res: NextResponse): NextResponse {
  /* Content-Security-Policy: restrict to self + known external services. */
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co https://api.deepseek.com https://generativelanguage.googleapis.com https://image.pollinations.ai",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  /* HSTS only over HTTPS (x-forwarded-proto check works behind CDNs). */
  const proto = res.headers.get("x-forwarded-proto") ?? "";
  if (proto === "https" || process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return res;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected && !hasSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  /* If already signed in and visiting /login, bounce to the lobby. */
  if (pathname === "/login" && hasSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/lobby";
    url.search = "";
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Run on everything except Next internals, the OAuth callback
     * route, API routes (webhooks/streams must not be auth-gated by
     * the proxy), and common static metadata files.
     */
    "/((?!api|_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|auth/callback).*)",
  ],
};