/**
 * Safety filters applied to every chat message before it is persisted or
 * sent to the AI. Three concerns share this file:
 *
 *  1. `sanitizeMessage`  — redacts PII (URLs, emails, phone numbers).
 *  2. `scrubInjection`    — neutralises prompt-injection attempts.
 *  3. `containsBlockedTerm` — hard-blocks CSAM-adjacent / extreme-violence
 *                            / doxxing terms; the message is refused rather
 *                            than redacted.
 *
 * Call `sanitizeAndScrub` for the combined redaction pipeline, and gate
 * persistence on `containsBlockedTerm` returning false.
 */

const URL_REGEX =
  /\b(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.!,?;:)]|\b[a-z0-9-]+\.(?:com|net|org|io|co|app|xyz|me|gg|tv|info|biz|us|uk|ca|de|fr)\b\/?[^\s<>"']*/gi;

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

const PHONE_REGEX =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/g;

/**
 * Replaces URLs, email addresses, and phone numbers in `text` with the
 * placeholder `[REDACTED]`. Returns the sanitized string. The function
 * is defensive: if given a non-string, returns an empty string.
 */
export function sanitizeMessage(text: string): string {
  if (typeof text !== "string" || text.length === 0) return "";

  return text
    .replace(URL_REGEX, "[REDACTED]")
    .replace(EMAIL_REGEX, "[REDACTED]")
    .replace(PHONE_REGEX, (match) => {
      const stripped = match.replace(/[\s.\-()+]/g, "");
      return stripped.length >= 7 ? "[REDACTED]" : match;
    });
}

/* ──────────────────────────────────────────────────────────────────
 * Prompt-injection scrubbing
 *
 * Patterns that attempt to reassign the AI's role or extract its
 * system prompt. These are matched case-insensitively against the raw
 * message text and replaced with `[REDACTED]` before the message ever
 * reaches the model. Layer 1 (system-role primacy) and Layer 2 (the
 * anti-injection clause baked into `buildSystemPrompt`) live in
 * `lib/ai/prompts.ts`; this is Layer 3 — server/client message scrubbing.
 * ────────────────────────────────────────────────────────────────── */

const INJECTION_PATTERNS: RegExp[] = [
  /* role-reassignment commands */
  /ignore (?:all )?(?:previous|prior|above) instructions/gi,
  /disregard (?:all )?(?:previous|prior|above) instructions/gi,
  /forget (?:all )?(?:previous|prior|your) (?:instructions|prompt)/gi,
  /\byou are now (?:a|an) (?:terminal|shell|linux|computer|assistant|jailbroken|unrestricted|dan)/gi,
  /\bact as (?:a|an) (?:terminal|shell|linux|computer|jailbroken|unrestricted)/gi,
  /\bpretend(?: to be)? (?:you are|to be) (?:a|an) (?:terminal|shell|linux|computer)/gi,
  /\b(?:enter|switch to|enable) (?:dev|developer|jailbreak|god|sudo) mode/gi,
  /do anything now\b/gi,
  /* system-prompt extraction */
  /(?:show|print|repeat|reveal|display) (?:me )?(?:your )?(?:system )?prompt/gi,
  /(?:what (?:is|are) your|state your) (?:system )?(?:instructions|prompt|rules)/gi,
  /repeat (?:the )?above (?:text|instructions|prompt)/gi,
  /* shell / command-execution tokens */
  /\bsudo\b/gi,
  /\brm -rf\b/gi,
  /(?:^|\n)\s*(?:\$|>>>?)\s?\w/g,
  /(?:^|\n)\s*`(?:bash|sh|python|-system)\b/gi,
];

/**
 * Neutralises prompt-injection attempts in a chat message. Returns the
 * scrubbed text. Idempotent and order-independent with `sanitizeMessage`.
 */
export function scrubInjection(text: string): string {
  if (typeof text !== "string" || text.length === 0) return "";

  let out = text;
  for (const pattern of INJECTION_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

/**
 * Convenience pipeline: redact PII, then neutralise injection attempts.
 * Use this in the client `onSend` path so every outgoing message is
 * cleaned through a single chokepoint.
 */
export function sanitizeAndScrub(text: string): string {
  return scrubInjection(sanitizeMessage(text));
}

/* ──────────────────────────────────────────────────────────────────
 * Blocked terms (hard refusal, not redaction)
 *
 * A SHORT, REVIEWABLE list — not exhaustive. Catches the most severe
 * CSAM-adjacent, extreme-violence, and doxxing phrases. Matching is
 * case-insensitive on whole-word boundaries. When a message trips this
 * filter, the message is NOT sent, NOT persisted, and NOT shown to the
 * AI — the client surfaces "Message blocked" instead.
 *
 * OpenAI Moderation API (deferred per budget) layers richer detection
 * on top of this keyword floor post-revenue.
 * ────────────────────────────────────────────────────────────────── */

export const BLOCKED_TERMS: readonly string[] = [
  /* CSAM-adjacent (clinical descriptors, no vulgarity list kept minimal) */
  "csam",
  "child porn",
  "loli",
  "shotacon",
  "minor nude",
  "underage nude",
  "pedo",
  "pedophile",
  "prepubescent",
  /* extreme violence / murder planning */
  "how to murder",
  "how to kill someone",
  "snuff film",
  "mass shooting plan",
  "build a bomb",
  /* doxxing verbs targeting a person */
  "dox them",
  "doxx them",
  "leak their address",
  "leak their phone",
  "post their ip",
  "swat them",
];

const BLOCKED_TERMS_REGEX: RegExp = (() => {
  const escaped = BLOCKED_TERMS.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");
})();

/**
 * Returns true if `text` contains a hard-blocked term. When true, the
 * caller MUST refuse the send: do not persist, do not show, do not pass
 * to the AI. Surface a generic "Message blocked" message instead — do
 * not echo the offending term back to the user.
 */
export function containsBlockedTerm(text: string): boolean {
  if (typeof text !== "string" || text.length === 0) return false;
  return BLOCKED_TERMS_REGEX.test(text);
}