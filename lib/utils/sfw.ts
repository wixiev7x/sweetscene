/**
 * SFW repositioning (user decision A, 2026-11-10): while Stripe is the
 * payment processor, the platform genuinely runs safe-for-work only.
 *
 * Set NEXT_PUBLIC_SFW_MODE=1 in the environment to enable:
 *  - NSFW creation is REJECTED server-side in lib/actions/characters.ts
 *    (not merely hidden client-side).
 *  - Public browsing never lists NSFW characters.
 *  - NSFW toggles, badges and adult-content copy are removed from the UI.
 *
 * This is a real product state, not a review-time trick: the flag stays on
 * for as long as Stripe is the processor. Flip only when switching away
 * from Stripe (see docs/RESTORE-CRYPTO.md for that path).
 *
 * The constant is inlined at build time for client components and read
 * from the runtime environment in server actions — on Vercel both come
 * from the same project env, so they cannot disagree.
 */
export const SFW_MODE = process.env.NEXT_PUBLIC_SFW_MODE === "1";
