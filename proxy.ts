import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
  "/complete-profile",
  "/age-verify",
  "/reset-password",
  "/admin",
];

const PUBLIC_EXCEPTIONS = ["/admin/login"];

function hasSessionCookie(req: NextRequest): boolean {
  const cookies = req.cookies.getAll();
  return cookies.some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );
}

/**
 * Phase 17: ban redirect. For signed-in visits to protected pages, ask
 * the `is_current_user_banned` SECURITY DEFINER RPC whether the account
 * is currently banned and, if so, send the user to /banned (which shows
 * the stored reason and expiry). This is a UX routing layer, NOT the
 * enforcement layer — every Server Action still fails closed via
 * assertNotBanned, RLS still blocks writes, and /api routes are
 * unaffected (the matcher excludes them). Fails OPEN on any error here
 * for the same reason the auth check is optimistic: the real gates are
 * server-side and this must never become a self-inflicted outage.
 *
 * The RPC lazily clears an expired temp ban, so this also self-heals.
 */
async function isBanned(req: NextRequest): Promise<boolean> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          /* Read-only check: the RPC performs no cookie writes. */
          setAll: () => {},
        },
      }
    );

    /* Verify the JWT server-side so anonymous / garbage cookies short-
       circuit without an RPC round-trip. */
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase.rpc("is_current_user_banned");
    return Array.isArray(data) ? data[0] === true : data === true;
  } catch {
    return false;
  }
}

/**
 * Builds the security headers that every response should carry (S9).
 * Set on the response going downstream to the client.
 */
function withSecurityHeaders(res: NextResponse, req: NextRequest): NextResponse {
  /* D1/D2: tightened CSP — specific Supabase project URL instead of
     wildcard, removed unused provider endpoints, scoped img-src to
     known image hosts instead of wildcard https:.

     Phase 12 corrections:
       - frame-src was missing entirely, so it inherited default-src
         'self' and blocked the Cloudflare Turnstile iframe. The captcha
         could never render and login was unreachable behind a CSP-
         enforcing browser.
       - img-src omitted Supabase storage (character avatars and profile
         pictures live there) and the Unsplash fallback used by
         generateImage(). Both rendered as broken images.
       - object-src 'none' blocks <object>/<embed> plugin content, which
         this app never uses and which bypasses several other directives.
       - connect-src no longer lists the AI provider: generation happens
         in server actions, so the browser never talks to it directly.
         The endpoint is admin-configurable now, so an allowlist entry
         here would be wrong the moment it is changed. */
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabaseUrl ? ` wss://${supabaseUrl.replace(/^https?:\/\//, "")}` : "";
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    `img-src 'self' data: blob: ${supabaseUrl} https://image.pollinations.ai https://images.unsplash.com`,
    `connect-src 'self'${supabaseUrl ? ` ${supabaseUrl}` : ""}${supabaseWs} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  /* D3: HSTS reads x-forwarded-proto from the *request*, not the
     response. Reading from res (a fresh NextResponse) always yields
     null, making the proto check dead code. */
  const proto = req.headers.get("x-forwarded-proto") ?? "";
  if (proto === "https" || process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected && !hasSessionCookie(req) && !PUBLIC_EXCEPTIONS.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return withSecurityHeaders(NextResponse.redirect(url), req);
  }

  /* Phase 17: signed-in + banned + visiting a protected page → /banned.
     /banned is not in PROTECTED_PREFIXES, so there is no redirect loop.
     Shadow bans are deliberately NOT routed — a shadow-banned user must
     experience the site normally (their content is filtered out by the
     messages SELECT policy and claim_match instead). */
  if (isProtected && hasSessionCookie(req) && !PUBLIC_EXCEPTIONS.includes(pathname)) {
    if (await isBanned(req)) {
      const url = req.nextUrl.clone();
      url.pathname = "/banned";
      url.search = "";
      return withSecurityHeaders(NextResponse.redirect(url), req);
    }
  }

  /* If already signed in and visiting /login, bounce to the lobby. */
  if (pathname === "/login" && hasSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/lobby";
    url.search = "";
    return withSecurityHeaders(NextResponse.redirect(url), req);
  }

  /* If already signed in and visiting /admin/login, bounce to /admin.
     The admin layout will re-check is_admin server-side. */
  if (pathname === "/admin/login" && hasSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return withSecurityHeaders(NextResponse.redirect(url), req);
  }

  return withSecurityHeaders(NextResponse.next(), req);
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