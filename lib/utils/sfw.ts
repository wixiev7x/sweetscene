/**
 * SFW repositioning (user decision A, 2026-11-10): while the card
 * processor (Paddle) requires it, the platform genuinely runs safe-for-work only.
 *
 * Set NEXT_PUBLIC_SFW_MODE=1 in the environment to enable:
 *  - NSFW creation is REJECTED server-side in lib/actions/characters.ts
 *    (not merely hidden client-side).
 *  - Public browsing never lists NSFW characters.
 *  - NSFW toggles, badges and adult-content copy are removed from the UI.
 *
 * This is a real product state, not a review-time trick: the flag stays on
 * until an adult-content processor (e.g. CCBill) is live. Flip only then (see docs/RESTORE-CRYPTO.md for that path).
 *
 * The constant is inlined at build time for client components and read
 * from the runtime environment in server actions — on Vercel both come
 * from the same project env, so they cannot disagree.
 */
export const SFW_MODE = process.env.NEXT_PUBLIC_SFW_MODE === "1";

/** Server-side clamp: NSFW is never effective while SFW_MODE is on. */
export function effectiveNsfw(requested: boolean | null | undefined): boolean {
  return !SFW_MODE && requested === true;
}
