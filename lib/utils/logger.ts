import "server-only";
import { getSetting, SETTING_KEYS } from "@/lib/config/settings";

/**
 * Structured logger.
 *
 * Every line is a single JSON object on stdout/stderr, which is what
 * Vercel, Fly, Railway, and a plain `docker logs` all index. That alone
 * is the baseline: the platform previously had no error reporting of any
 * kind, because this module existed but nothing imported it, and its
 * only out-of-band sink was a Sentry hook that returned immediately
 * whether or not SENTRY_DSN was set. Configuring a DSN bought silence
 * that looked like monitoring.
 *
 * The sink is now a plain webhook POST — a Discord or Slack incoming
 * webhook URL works unmodified, as does any collector that accepts JSON.
 * No SDK, no dependency, and it resolves through lib/config/settings so
 * it is rotatable from /admin/settings like every other secret.
 *
 * Usage:
 *   import { logger } from "@/lib/utils/logger";
 *   logger.info("match_created", { matchId });
 *   logger.error("ai_call_failed", { matchId, err });
 */

type LogMeta = Record<string, unknown>;

type LogLevel = "info" | "warn" | "error";

/**
 * Keys whose values must never leave the process, even into a log line
 * the operator owns. Matched case-insensitively as substrings, so
 * `apiKey`, `AI_API_KEY`, and `user_password` are all caught.
 */
const REDACT_KEYS = [
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "session",
  "dsn",
  "encryption",
  "signature",
  "ipn",
];

const MAX_STRING = 500;

/**
 * Normalises a value for logging: unwraps Errors to a message plus a
 * trimmed stack, redacts anything key-matched, truncates long strings,
 * and bounds recursion so a cyclic or enormous object cannot wedge the
 * logger. Never throws — a logger that can throw turns an error path
 * into a crash.
 */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (value === null || value === undefined) return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message.slice(0, MAX_STRING),
      stack: value.stack?.split("\n").slice(0, 5).join("\n"),
    };
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      out[k] = REDACT_KEYS.some((r) => lower.includes(r))
        ? "[redacted]"
        : sanitize(v, depth + 1);
    }
    return out;
  }

  return String(value).slice(0, MAX_STRING);
}

/**
 * Ships a line to the configured webhook. Best-effort by design: a
 * failed POST is written to stderr and dropped rather than retried, so
 * an outage at the collector cannot back up onto request latency or
 * recurse into the logger.
 */
async function ship(payload: Record<string, unknown>): Promise<void> {
  let url: string | undefined;
  try {
    url = await getSetting(
      SETTING_KEYS.errorWebhookUrl,
      process.env.ERROR_WEBHOOK_URL
    );
  } catch {
    return;
  }
  if (!url) return;

  const body = JSON.stringify(payload);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      /* `content` is what Discord renders; Slack reads `text`. Sending
         both means one URL works for either without configuration, and
         a generic collector still gets the structured fields. */
      body: JSON.stringify({
        ...payload,
        content: `\`${payload.level}\` **${payload.event}**\n\`\`\`json\n${body.slice(0, 1500)}\n\`\`\``,
        text: `${payload.level} ${payload.event}: ${body.slice(0, 1500)}`,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
  } catch {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "warn",
        event: "logger_webhook_failed",
      })
    );
  }
}

function log(level: LogLevel, event: string, meta?: LogMeta): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...((sanitize(meta ?? {}) as LogMeta) ?? {}),
  };

  const line = JSON.stringify(payload);

  switch (level) {
    case "info":
      console.log(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
  }

  /* Only warn and error reach the webhook. Shipping info would turn a
     Discord channel into a firehose and get the URL rate-limited, at
     which point the errors stop arriving too. */
  if (level === "error" || level === "warn") {
    void ship(payload);
  }
}

export const logger = {
  info: (event: string, meta?: LogMeta) => log("info", event, meta),
  warn: (event: string, meta?: LogMeta) => log("warn", event, meta),
  error: (event: string, meta?: LogMeta) => log("error", event, meta),
};
