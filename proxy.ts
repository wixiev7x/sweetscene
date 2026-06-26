import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy (Next 16 successor to middleware.ts). Redirects unauthenticated
 * users away from protected routes to /login. This is an *optimistic*
 * check against the Supabase auth cookie name — real authorization still
 * happens in each Server Action and via RLS. Public routes are /, /login,
 * /auth and their subpaths.
 *
 * Note: Supabase SSR stores the auth token under a cookie named like
 * `sb-<project-ref>-auth-token`. We detect any cookie starting with
 * `sb-` and containing `-auth-token` as a sign of an active session.
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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected && !hasSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  /* If already signed in and visiting /login, bounce to the lobby. */
  if (pathname === "/login" && hasSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/lobby";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
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