import "server-only";
import { containsBlockedTerm } from "@/lib/utils/safety";
import { getSetting, SETTING_KEYS } from "@/lib/config/settings";
import { logger } from "@/lib/utils/logger";

/* ════════════════════════════════════════════════════════════════════
 * Content moderation — the semantic layer above the keyword floor.
 *
 * `containsBlockedTerm` in lib/utils/safety.ts catches restatements of
 * a phrase it already knows: spacing, homoglyphs, digit substitution,
 * doubled letters. It cannot catch paraphrase, and no keyword list can.
 * "She's in fourth grade and I want to..." contains no blocked term and
 * is exactly what a floor is supposed to stop.
 *
 * So every server-side write path calls `moderateText`, which runs the
 * floor first (free, synchronous, no network) and then the configured
 * classifier. The floor alone is still the behaviour of an install that
 * has configured no provider, so this is strictly additive.
 *
 * ── Why the provider is a setting and not a hardcoded import ─────────
 * Same reason as every other credential in this codebase: it resolves
 * through lib/config/settings.ts, so the operator swaps or rotates it
 * from /admin/settings without a redeploy. No key is compiled into the
 * bundle.
 *
 * ── Why this is server-only ─────────────────────────────────────────
 * It holds an API key. `containsBlockedTerm` stays isomorphic and the
 * client keeps calling it directly for instant feedback, but that
 * client-side call is a courtesy, not a control — it is trivially
 * bypassed by anyone posting to the server action directly. This module
 * is the enforcement point.
 * ════════════════════════════════════════════════════════════════════ */

export type ModerationVerdict =
  | { allowed: true }
  | { allowed: false; reason: string };

export type ModerationOptions = {
  /**
   * Whether the surface being written to legitimately permits adult
   * sexual content. An NSFW character's prompt is allowed to be
   * explicit; the same text in an SFW scene is not.
   *
   * This never widens what is permitted for minors — the `sexual/minors`
   * category is refused at every value of this flag, and access to NSFW
   * surfaces at all is gated separately on `age_cohort = 'adult'` in the
   * database.
   */
  nsfwAllowed?: boolean;
  /** Short label for logs: "dm", "solo", "character". Never the text. */
  surface?: string;
};

/**
 * Categories refused no matter what the surface permits. These have no
 * legitimate use in fiction on this platform, and two of them are the
 * platform's legal exposure rather than a matter of taste.
 */
const ALWAYS_REFUSE = [
  "sexual/minors",
  "self-harm/instructions",
  "illicit/violent",
  "hate/threatening",
  "harassment/threatening",
  "hate",
] as const;

/**
 * Categories refused only on SFW surfaces. An adult roleplay platform
 * that blocked `sexual` outright would have no product; one that never
 * blocked it would have no SFW mode.
 *
 * `harassment` is deliberately absent. Characters in a scene are
 * frequently hostile to each other on purpose, and refusing that would
 * break ordinary fiction. Harassment between real users is handled by
 * the report and block paths, which act on people rather than strings.
 */
const REFUSE_UNLESS_NSFW = [
  "sexual",
  "violence",
  "violence/graphic",
  "self-harm",
  "illicit",
] as const;

const OPENAI_DEFAULT_ENDPOINT = "https://api.openai.com/v1/moderations";
const OPENAI_DEFAULT_MODEL = "omni-moderation-latest";

/**
 * Wall-clock budget for the classifier call. This sits in the latency
 * path of every sent message, so it is short: a slow verdict that
 * arrives after the user has given up is worth nothing, and the floor
 * has already run by this point.
 */
const TIMEOUT_MS = 2500;

/** Longest text sent to a classifier. Beyond this it is truncated. */
const MAX_CLASSIFY_LENGTH = 8000;

type ProviderOutcome =
  | { ok: true; flagged: false }
  | { ok: true; flagged: true; categories: string[] }
  | { ok: false };

/**
 * Calls OpenAI's moderations endpoint. The endpoint is free and does
 * not consume paid credit, which is why it is the default suggestion.
 *
 * Reads the per-category booleans rather than the top-level `flagged`,
 * because `flagged` is true for any category at all — including plain
 * `sexual`, which is the entire point of the NSFW half of this product.
 */
async function classifyOpenAI(
  text: string,
  apiKey: string,
  endpoint: string,
  refuse: Set<string>,
  signal: AbortSignal
): Promise<ProviderOutcome> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: OPENAI_DEFAULT_MODEL, input: text }),
    signal,
  });

  if (!res.ok) return { ok: false };

  const body = (await res.json()) as {
    results?: Array<{ categories?: Record<string, boolean> }>;
  };

  const categories = body.results?.[0]?.categories;
  if (!categories || typeof categories !== "object") return { ok: false };

  const hits = Object.entries(categories)
    .filter(([name, hit]) => hit === true && refuse.has(name))
    .map(([name]) => name);

  return hits.length > 0
    ? { ok: true, flagged: true, categories: hits }
    : { ok: true, flagged: false };
}

/**
 * Calls an operator-supplied endpoint. The contract is deliberately
 * small so a Cloudflare Worker or a Lambda in front of Perspective,
 * Hive, or a self-hosted model satisfies it in a few lines:
 *
 *   POST { text, nsfwAllowed, refuse: string[] }
 *   200  { flagged: boolean, categories?: string[] }
 *
 * `{ allowed: boolean }` is accepted as an alias, because that is the
 * shape people write by hand on the first try.
 */
async function classifyWebhook(
  text: string,
  endpoint: string,
  apiKey: string | undefined,
  nsfwAllowed: boolean,
  refuse: Set<string>,
  signal: AbortSignal
): Promise<ProviderOutcome> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ text, nsfwAllowed, refuse: [...refuse] }),
    signal,
  });

  if (!res.ok) return { ok: false };

  const body = (await res.json()) as {
    flagged?: unknown;
    allowed?: unknown;
    categories?: unknown;
  };

  const flagged =
    body.flagged === true ||
    (body.flagged === undefined && body.allowed === false);

  /* Neither field present means the response did not answer the
     question. Treat it as a provider failure rather than as consent. */
  if (body.flagged === undefined && body.allowed === undefined) {
    return { ok: false };
  }

  if (!flagged) return { ok: true, flagged: false };

  const categories = Array.isArray(body.categories)
    ? body.categories.filter((c): c is string => typeof c === "string")
    : ["webhook"];

  return { ok: true, flagged: true, categories };
}

/**
 * Screens text before it is persisted, shown, or sent to the model.
 *
 * Order is deliberate. The keyword floor runs first and unconditionally:
 * it costs nothing, it cannot fail, and it means the worst content is
 * refused even when the classifier is misconfigured, unreachable, or
 * switched off entirely.
 *
 * @param text - The untrusted text to screen.
 * @param options - Surface context; see ModerationOptions.
 * @returns `{ allowed: true }`, or a verdict carrying a generic reason.
 *          The reason is safe to show a user: it never echoes the
 *          offending text and never names the category, because naming
 *          the category tells an attacker which knob to turn.
 */
export async function moderateText(
  text: string,
  options: ModerationOptions = {}
): Promise<ModerationVerdict> {
  const { nsfwAllowed = false, surface = "unknown" } = options;

  if (containsBlockedTerm(text)) {
    return { allowed: false, reason: "Message blocked" };
  }

  const provider = (
    await getSetting(
      SETTING_KEYS.moderationProvider,
      process.env.MODERATION_PROVIDER
    )
  )
    ?.trim()
    .toLowerCase();

  if (!provider || provider === "none" || provider === "off") {
    return { allowed: true };
  }

  const [apiKey, endpointSetting, failClosedSetting] = await Promise.all([
    getSetting(SETTING_KEYS.moderationApiKey, process.env.MODERATION_API_KEY),
    getSetting(
      SETTING_KEYS.moderationEndpoint,
      process.env.MODERATION_ENDPOINT
    ),
    getSetting(
      SETTING_KEYS.moderationFailClosed,
      process.env.MODERATION_FAIL_CLOSED
    ),
  ]);

  const failClosed = failClosedSetting?.trim().toLowerCase() === "true";

  /* A provider that is named but not usable is a configuration error,
     not a verdict. Announce it loudly — silently degrading to "allow"
     is how an operator ends up believing they have moderation. */
  const unusable =
    (provider === "openai" && !apiKey) ||
    (provider === "webhook" && !endpointSetting);

  if (unusable) {
    logger.error("moderation_misconfigured", { provider, surface });
    return failClosed
      ? { allowed: false, reason: "Message could not be checked. Try again." }
      : { allowed: true };
  }

  const refuse = new Set<string>(ALWAYS_REFUSE);
  if (!nsfwAllowed) for (const c of REFUSE_UNLESS_NSFW) refuse.add(c);

  const input = text.slice(0, MAX_CLASSIFY_LENGTH);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let outcome: ProviderOutcome = { ok: false };

  try {
    if (provider === "openai") {
      outcome = await classifyOpenAI(
        input,
        apiKey as string,
        endpointSetting?.trim() || OPENAI_DEFAULT_ENDPOINT,
        refuse,
        controller.signal
      );
    } else if (provider === "webhook") {
      outcome = await classifyWebhook(
        input,
        endpointSetting as string,
        apiKey,
        nsfwAllowed,
        refuse,
        controller.signal
      );
    } else {
      logger.error("moderation_unknown_provider", { provider, surface });
      outcome = { ok: false };
    }
  } catch (err) {
    /* Timeout, DNS failure, TLS failure, malformed JSON. */
    logger.warn("moderation_call_failed", { provider, surface, err });
    outcome = { ok: false };
  } finally {
    clearTimeout(timer);
  }

  if (!outcome.ok) {
    if (failClosed) {
      return { allowed: false, reason: "Message could not be checked. Try again." };
    }
    /* Fail-open is the default, and it is a real trade-off rather than
       an oversight: the alternative is that an outage at OpenAI stops
       every conversation on the platform. The keyword floor already
       ran and passed, so this is not an unscreened message — it is a
       message screened by one layer instead of two. Operators who
       would rather take the downtime set moderation_fail_closed=true. */
    return { allowed: true };
  }

  if (outcome.flagged) {
    /* Categories are logged, never returned. The operator needs to know
       what is being refused; the author must not learn which category
       to steer around. */
    logger.warn("moderation_blocked", {
      provider,
      surface,
      categories: outcome.categories,
    });
    return { allowed: false, reason: "Message blocked" };
  }

  return { allowed: true };
}

/**
 * What a refused generation is replaced with.
 *
 * Deliberately identical to the string both AI paths already return
 * when the provider errors, so a user who successfully steered the
 * model into prohibited output cannot tell that apart from the model
 * simply failing. Distinguishable refusals are a gradient, and a
 * gradient is something to climb.
 */
export const SAFE_FALLBACK_REPLY =
  "The character hesitates and falls silent for a moment…";

/**
 * Screens generated text on its way out of the model.
 *
 * A refusal returns the fallback line rather than an error. The user
 * has already been charged for the turn, and handing them a failure
 * for something the model did — not something they did — reads as a
 * bug. More to the point, the goal here is that the prohibited text
 * never reaches a screen, and substitution achieves that as well as an
 * error does while telling an attacker less.
 *
 * @param text - The model's output, already scrubbed of injection/PII.
 * @param options - Surface context; see ModerationOptions.
 * @returns The original text, or the fallback line if it was refused.
 */
export async function screenOutput(
  text: string,
  options: ModerationOptions = {}
): Promise<string> {
  if (!text.trim()) return text;
  const verdict = await moderateText(text, options);
  return verdict.allowed ? text : SAFE_FALLBACK_REPLY;
}

/**
 * Screens several fields at once, short-circuiting on the first
 * refusal. Used by the character create/update path, where a dozen
 * authored fields all land in the same system prompt.
 *
 * Empty and whitespace-only fields are skipped rather than screened:
 * `containsBlockedTerm` refuses the empty string by design, and an
 * optional field the user left blank is not a policy violation.
 */
export async function moderateFields(
  fields: readonly string[],
  options: ModerationOptions = {}
): Promise<ModerationVerdict> {
  for (const field of fields) {
    if (typeof field !== "string" || !field.trim()) continue;
    const verdict = await moderateText(field, options);
    if (!verdict.allowed) return verdict;
  }
  return { allowed: true };
}
