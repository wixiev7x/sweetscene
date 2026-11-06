import "server-only";

/**
 * Phase 12 — avatar URL validation.
 *
 * `avatar_url` is set by whoever creates a character and is then
 * rendered in every viewer's browser. Unvalidated, that is three
 * separate problems:
 *
 *   1. Deanonymization. This platform promises anonymous roleplay, but
 *      an <img> pointing at a creator-controlled host hands that host
 *      the IP address, User-Agent and approximate location of every
 *      user who so much as scrolls past the card. That defeats the
 *      core product promise, and no amount of RLS helps.
 *   2. CSS injection. app/characters/page.tsx interpolates the value
 *      into `backgroundImage: url(${...})`. React does not escape
 *      inline style values, so a `)` in the URL closes url() early and
 *      the rest is parsed as CSS.
 *   3. Scheme abuse. `javascript:` is inert in <img src>, but the same
 *      column would be live XSS the moment anyone renders it as a link.
 *
 * The fix is an allowlist. Avatars must be https and must live on a
 * host the platform already trusts — its own Supabase storage, or the
 * image services it generates through.
 */

/** Nothing legitimate is close to this long. */
const MAX_URL_LENGTH = 2048;

/**
 * Characters that would break out of `url(...)` in a CSS context, or
 * out of an attribute. A conforming https URL never needs these raw.
 */
const CSS_BREAKOUT = /["'()\\;{}<>\s]/;

/**
 * Hosts permitted to serve avatars. Supabase storage is derived from
 * the project URL so self-hosted uploads work without extra config.
 */
function allowedHosts(): Set<string> {
  const hosts = new Set<string>([
    "image.pollinations.ai",
    "images.unsplash.com",
  ]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      hosts.add(new URL(supabaseUrl).hostname);
    } catch {
      /* Malformed env value — fall through with the static hosts. */
    }
  }

  return hosts;
}

/**
 * Phase 5 — local-dev storage support. The supabase CLI stack serves
 * storage over plain http on the loopback interface. Uploaded avatars
 * would then be http://127.0.0.1:54321/storage/... URLs, which the
 * strict https rule below would reject and break the whole upload →
 * publish flow on dev.
 *
 * The allowance is deliberately narrow: it only fires when
 *   1. the configured NEXT_PUBLIC_SUPABASE_URL itself uses http (a
 *      production/staging deployment is https, so this is false there),
 *   2. the env host is a loopback address (localhost/127.0.0.1/::1), and
 *   3. the candidate URL matches that exact host over http.
 * Static hosts (Pollinations/Unsplash) remain https-only everywhere.
 */
function allowsLocalHttp(parsed: URL): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;
  let envUrl: URL;
  try {
    envUrl = new URL(supabaseUrl);
  } catch {
    return false;
  }
  if (envUrl.protocol !== "http:") return false;
  const host = envUrl.hostname;
  const isLoopback =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLoopback) return false;
  return parsed.protocol === "http:" && parsed.hostname === host;
}

export type AvatarUrlResult = { url: string | null } | { error: string };

/**
 * Validates a user-supplied avatar URL. Returns the normalized URL, or
 * null when the input was empty (which is a valid "no avatar" state).
 */
export function validateAvatarUrl(
  raw: string | null | undefined
): AvatarUrlResult {
  if (raw === null || raw === undefined) return { url: null };
  if (typeof raw !== "string") return { error: "Invalid avatar URL" };

  const trimmed = raw.trim();
  if (!trimmed) return { url: null };

  if (trimmed.length > MAX_URL_LENGTH) {
    return { error: "Avatar URL is too long" };
  }

  if (CSS_BREAKOUT.test(trimmed)) {
    return { error: "Avatar URL contains invalid characters" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: "Avatar URL must be a full https:// URL" };
  }

  if (parsed.protocol !== "https:" && !allowsLocalHttp(parsed)) {
    return { error: "Avatar URL must use https" };
  }

  /* Credentials in a URL are never legitimate here and some clients
     surface them to the user as a phishing lure. */
  if (parsed.username || parsed.password) {
    return { error: "Avatar URL must not contain credentials" };
  }

  if (!allowedHosts().has(parsed.hostname)) {
    return {
      error:
        "Avatar images must be uploaded to the platform. External image links are not allowed.",
    };
  }

  return { url: parsed.toString() };
}
