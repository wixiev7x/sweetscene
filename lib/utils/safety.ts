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

  /* ── Delimiter injection ──
     lib/ai/prompts.ts fences untrusted character text between
     CHARACTER_BRIEF markers, and ai_wrapper.ts fences the rolling
     recap in <RECAP> tags, with the policy block telling the model
     that everything inside is data rather than instruction. Text that
     reproduces a closing marker escapes its own fence: whatever
     follows appears to the model to be outside the untrusted region
     and therefore trusted. That defeats the entire scheme, so the
     markers are treated as reserved tokens and never survive in user
     or character-authored content. */
  /-{2,}\s*(?:BEGIN|END)\s+CHARACTER_BRIEF[^\n]*/gi,
  /<\/?\s*RECAP\s*>/gi,

  /* Fake turn boundaries. A line starting "System:" or "Assistant:"
     invites the model to read the following text as a new authoritative
     turn rather than as dialogue inside the scene. */
  /(?:^|\n)\s*(?:system|assistant|developer)\s*:/gi,
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
 * CSAM-adjacent, extreme-violence, and doxxing phrases. When a message
 * trips this filter, the message is NOT sent, NOT persisted, and NOT
 * shown to the AI — the caller surfaces "Message blocked" instead.
 *
 * This is the FLOOR, and it is deliberately synchronous and dependency
 * free so it can run in the browser as well as on the server. The
 * semantic layer that catches paraphrase — a real classifier — lives in
 * `lib/utils/moderation.ts`, is server-only, and calls this first.
 *
 * ── Why matching is not a plain substring test ──────────────────────
 * The previous implementation was `\b(?:term|term)\b` against the raw
 * text. Every one of these walked through it untouched:
 *
 *   p e d o          separators between letters
 *   p.e.d.o          punctuation between letters
 *   p‌edo             a zero-width non-joiner (U+200C) mid-word
 *   рedo             Cyrillic er (U+0440) — renders identically to "p"
 *   pédo             a combining acute the browser draws over the e
 *   p3d0             digit substitution
 *   ｐｅｄｏ            fullwidth forms
 *   peddo            a doubled letter
 *
 * So the text is normalised first (Unicode compatibility decomposition,
 * combining marks and invisibles stripped, homoglyphs folded to Latin)
 * and each term is compiled into a pattern that tolerates separators,
 * digit/symbol substitution, and repeated letters.
 *
 * The normalised form is used for MATCHING ONLY. It is never stored,
 * never displayed, and never sent to the model — the original text is.
 * ────────────────────────────────────────────────────────────────── */

/**
 * Characters with no width or meaning of their own. They exist in a
 * message only to break a word apart for a matcher while rendering
 * identically for a reader: zero-width space and joiners, bidi
 * overrides, the soft hyphen, and the Unicode tag block.
 */
const INVISIBLE_REGEX =
  /(?:[­͏؜᠎​-‏‪-‮⁠-⁤⁪-⁯﻿￹-￻]|\udb40[\udc00-\udc7f])/g;

/**
 * Combining marks. NFKD splits `é` into `e` + U+0301; dropping the mark
 * leaves the ASCII letter. Also covers the "zalgo" stacking ranges, so
 * a term buried under fifty diacritics still matches.
 */
const COMBINING_REGEX =
  /[̀-ͯ҃-҉᪰-᫿᷀-᷿⃐-⃰︠-︯]/g;

/**
 * Non-Latin characters that render as Latin letters and that NFKD does
 * NOT fold, because they are genuinely distinct letters in their own
 * script. Cyrillic а/е/о/р/с and Greek ο/ρ/ν are the workhorses of
 * homoglyph evasion precisely because they are legitimate codepoints.
 *
 * Folding these also fixes a subtler problem: JavaScript's `\b` and
 * `\w` are ASCII-only, so a Cyrillic letter reads as a NON-word
 * character to the regex engine. Left unfolded, `рedo` would not just
 * fail to match — it would put a word boundary in the middle of a word.
 */
const HOMOGLYPHS: Record<string, string> = {
  /* Cyrillic */
  "а": "a", "в": "b", "е": "e", "к": "k", "м": "m",
  "н": "h", "о": "o", "р": "p", "с": "c", "т": "t",
  "у": "y", "х": "x", "ѕ": "s", "і": "i", "ј": "j",
  "ԁ": "d", "һ": "h", "ӏ": "l", "ԛ": "q", "ԝ": "w",
  /* Greek */
  "α": "a", "β": "b", "γ": "y", "δ": "d", "ε": "e",
  "η": "n", "ι": "i", "κ": "k", "λ": "l", "μ": "m",
  "ν": "v", "ο": "o", "π": "n", "ρ": "p", "σ": "s",
  "τ": "t", "υ": "u", "χ": "x", "ω": "w", "ϲ": "c",
  /* Latin letters NFKD leaves alone, because they are not decomposable */
  "ı": "i", "ł": "l", "ø": "o", "đ": "d", "ð": "d",
  "þ": "p", "ß": "ss", "ɡ": "g", "ĸ": "k", "ƀ": "b",
  "ƚ": "l", "ƶ": "z", "ɇ": "e", "æ": "ae", "œ": "oe",
};

const HOMOGLYPH_REGEX = new RegExp(
  `[${Object.keys(HOMOGLYPHS).join("")}]`,
  "g"
);

/**
 * Collapses a string to the form the blocked-term patterns are written
 * against: NFKD-decomposed, stripped of combining marks and invisibles,
 * lowercased, and with homoglyphs folded to Latin.
 *
 * Order matters. Lowercasing happens before the homoglyph fold because
 * the map is keyed on lowercase codepoints, and `String.toLowerCase`
 * already handles Cyrillic and Greek case correctly.
 *
 * @param text - Arbitrary untrusted text.
 * @returns The normalised form, for matching only — never for storage.
 */
export function normalizeForMatching(text: string): string {
  if (typeof text !== "string" || text.length === 0) return "";

  return text
    .normalize("NFKD")
    .replace(COMBINING_REGEX, "")
    .replace(INVISIBLE_REGEX, "")
    .toLowerCase()
    .replace(HOMOGLYPH_REGEX, (c) => HOMOGLYPHS[c] ?? c);
}

export const BLOCKED_TERMS: readonly string[] = [
  /* CSAM-adjacent (clinical descriptors, vulgarity list kept minimal) */
  "csam",
  "child porn",
  "child sex",
  "child abuse material",
  "child sexual abuse",
  "sex with a child",
  "sex with a minor",
  "rape a child",
  "loli",
  "shotacon",
  "toddlercon",
  "jailbait",
  "minor nude",
  "underage nude",
  "pedo",
  "pedophile",
  "hebephile",
  "prepubescent",
  /* extreme violence / attack planning */
  "how to murder",
  "how to kill someone",
  "snuff film",
  "mass shooting plan",
  "school shooting plan",
  "build a bomb",
  "make a bomb",
  "pipe bomb",
  /* doxxing verbs targeting a person */
  "dox them",
  "doxx them",
  "leak their address",
  "leak their phone",
  "post their ip",
  "swat them",
];

/**
 * Characters that show up between the letters of an obfuscated word.
 *
 * Deliberately DISJOINT from the substitution alphabet below — no
 * character appears in both. Overlapping classes next to each other
 * ("is this `!` a separator or the letter i?") is the exact shape that
 * makes a regex backtrack exponentially, and this pattern runs on
 * attacker-supplied text on every single message.
 */
const SEP = "[\\s._\\-*'\"~,;:/\\\\=#&%()\\[\\]{}<>?^]";

/**
 * Digits and symbols that stand in for letters. Applied to interior
 * positions of a term only — see `termPattern`.
 */
const SUBSTITUTIONS: Record<string, string> = {
  a: "a4@",
  b: "b8",
  e: "e3",
  g: "g9",
  i: "i1!|",
  l: "l1!|",
  o: "o0",
  s: "s5$",
  t: "t7+",
  z: "z2",
};

/**
 * Terms shorter than this get NO separator tolerance.
 *
 * A four-letter sequence turns up across ordinary word boundaries all
 * the time: with separators allowed, "loli" matches the "lol i" in
 * "lol i don't know", and "pedo" matches "sped over". Splitting a short
 * word with punctuation is a rare evasion; matching innocent text is a
 * common one. Long phrases keep the tolerance, where the letter count
 * makes an accidental match vanishingly unlikely.
 */
const MIN_LENGTH_FOR_SEPARATOR_TOLERANCE = 6;

/** Escapes a literal for use inside a regex character class. */
function escapeClass(s: string): string {
  return s.replace(/[\\\]^-]/g, "\\$&");
}

/**
 * Compiles one blocked term into an evasion-tolerant pattern.
 *
 * Spaces in the term are dropped rather than matched literally: the
 * separator run inserted between every pair of letters already covers
 * them, so "how to murder" and "howtomurder" both match one pattern.
 *
 * Substitutions are withheld from the first and last letter. A trailing
 * `!` is punctuation far more often than it is the letter i, and
 * allowing it at an edge is what turns "oh! oli..." into a hit.
 */
function termPattern(term: string): string {
  const letters = [...term.toLowerCase()].filter((c) => /[a-z0-9]/.test(c));
  if (letters.length === 0) return "";

  const gap =
    letters.length >= MIN_LENGTH_FOR_SEPARATOR_TOLERANCE ? `${SEP}{0,4}` : "";

  const body = letters
    .map((c, i) => {
      const edge = i === 0 || i === letters.length - 1;
      const alphabet = SUBSTITUTIONS[c] ?? c;
      const usable = edge
        ? [...alphabet].filter((x) => /[a-z0-9]/.test(x)).join("")
        : alphabet;
      /* `+` absorbs doubled letters: "peddo", "ppedo", "pedooo". */
      return usable.length > 1 ? `[${escapeClass(usable)}]+` : `${usable}+`;
    })
    .join(gap);

  /* A consuming `(?:^|[^a-z0-9])` rather than `\b`, because the first
     class can contain non-word characters and `\b` inverts its meaning
     when it does. Only `.test()` reads this, so consuming a character
     costs nothing. The tail allows plain inflections — "pedos" is the
     term, "lollipop" is not. */
  return `(?:^|[^a-z0-9])${body}(?:s|es|ed|ing|er|ers)?(?![a-z0-9])`;
}

const BLOCKED_TERMS_REGEX: RegExp = new RegExp(
  BLOCKED_TERMS.map(termPattern).filter(Boolean).join("|")
);

/**
 * Returns true if `text` contains a hard-blocked term. When true, the
 * caller MUST refuse the send: do not persist, do not show, do not pass
 * to the AI. Surface a generic "Message blocked" message instead — do
 * not echo the offending term back to the user.
 *
 * Runs against the normalised form, so spacing, punctuation, homoglyph,
 * diacritic, zero-width, fullwidth, digit-substitution, and doubled
 * letter variants all collapse onto the same pattern.
 *
 * This is a floor, not a moderation system: it catches restatements of
 * a known phrase, not paraphrase. Server paths should call
 * `moderateText` from `lib/utils/moderation.ts`, which runs this and
 * then the configured classifier.
 */
export function containsBlockedTerm(text: string): boolean {
  if (typeof text !== "string" || text.length === 0) return true;
  return BLOCKED_TERMS_REGEX.test(normalizeForMatching(text));
}