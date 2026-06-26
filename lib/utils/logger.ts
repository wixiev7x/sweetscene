import "server-only";

/**
 * Structured logger for the chatty platform (S12). Provides a typed
 * logging interface with levels (info/warn/error) and an optional
 * Sentry hook. When SENTRY_DSN is not configured, logging is
 * console-only — the Sentry hook interface is ready for Phase 10 or
 * a future production setup to swap in the actual SDK.
 *
 * Usage:
 *   import { logger } from "@/lib/utils/logger";
 *   logger.info("match_created", { matchId });
 *   logger.error("ai_call_failed", { matchId, error });
 */

type LogMeta = Record<string, unknown>;

type LogLevel = "info" | "warn" | "error";

const SENTRY_DSN = process.env.SENTRY_DSN;

/**
 * Sentry capture hook. When SENTRY_DSN is set, this should be wired
 * to `@sentry/node`'s `captureException`. For now, it's a typed
 * no-op placeholder so the interface exists.
 */
async function captureSentry(level: LogLevel, event: string, meta: LogMeta): Promise<void> {
  if (!SENTRY_DSN) return;
  /* TODO (Phase 10): wire to `@sentry/node` when the SDK is installed.
   * For now, no-op so the app doesn't depend on an uninstalled package. */
  void level;
  void event;
  void meta;
}

function log(level: LogLevel, event: string, meta?: LogMeta): void {
  const timestamp = new Date().toISOString();
  const line = JSON.stringify({ ts: timestamp, level, event, ...(meta ?? {}) });

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

  /* Fire-and-forget the Sentry hook so logging never blocks. */
  void captureSentry(level, event, meta ?? {});
}

export const logger = {
  info: (event: string, meta?: LogMeta) => log("info", event, meta),
  warn: (event: string, meta?: LogMeta) => log("warn", event, meta),
  error: (event: string, meta?: LogMeta) => log("error", event, meta),
};