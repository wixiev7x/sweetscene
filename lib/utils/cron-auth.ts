import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Fail closed. */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return false;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
