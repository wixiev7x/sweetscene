/**
 * Routes that need a session. Shared by proxy.ts (redirects guests to the
 * login popup) and app/sitemap.ts (gated pages must not be advertised to
 * crawlers — they would only see a 307).
 */
export const PROTECTED_PREFIXES = [
  "/lobby",
  "/chat",
  "/dm",
  "/characters",
  "/create-character",
  "/profile",
  "/complete-profile",
  "/age-verify",
  "/reset-password",
  "/admin",
] as const;

export const PUBLIC_EXCEPTIONS = ["/admin/login"] as const;

export function isProtectedPath(pathname: string): boolean {
  if ((PUBLIC_EXCEPTIONS as readonly string[]).includes(pathname)) return false;
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
