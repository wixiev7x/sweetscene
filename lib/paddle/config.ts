import "server-only";

/* ════════════════════════════════════════════════════════════════════
 * Paddle Billing configuration — server-side env reads only.
 *
 * Paddle is merchant of record: it sells to the customer, handles
 * global sales tax/VAT, chargebacks and invoicing. Checkout is Paddle's
 * overlay, opened on /checkout (the "default payment link" set in the
 * Paddle dashboard) — card data never touches SweetScene.
 *
 * Env (names only — values live in Vercel / .env.local):
 *   PADDLE_ENV                       sandbox | production   (default sandbox)
 *   PADDLE_API_KEY                   server API key
 *   PADDLE_WEBHOOK_SECRET            notification destination secret
 *   NEXT_PUBLIC_PADDLE_CLIENT_TOKEN  client-side token (public by design)
 *   PADDLE_PRICE_VIP_MONTHLY / PADDLE_PRICE_VIP_YEARLY
 *   PADDLE_PRICE_TOKENS_S / _M / _L  (pri_… ids)
 *
 * Every value is read at request time, so a Vercel env change takes
 * effect on the next deploy without code edits.
 * ════════════════════════════════════════════════════════════════════ */

export const PRICE_ENV_BY_PRODUCT: Record<string, string> = {
  vip_monthly: "PADDLE_PRICE_VIP_MONTHLY",
  vip_yearly: "PADDLE_PRICE_VIP_YEARLY",
  starter: "PADDLE_PRICE_TOKENS_S",
  standard: "PADDLE_PRICE_TOKENS_M",
  whale: "PADDLE_PRICE_TOKENS_L",
};

const PRICE_ID_RE = /^pri_[a-z0-9]{10,}$/;

export function paddleEnv(): "sandbox" | "production" {
  return process.env.PADDLE_ENV === "production" ? "production" : "sandbox";
}

export function paddleApiBase(): string {
  return paddleEnv() === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

export function getPaddleApiKey(): string | null {
  const k = process.env.PADDLE_API_KEY ?? "";
  return k.length >= 20 ? k : null;
}

export function getPaddleWebhookSecret(): string | null {
  const s = process.env.PADDLE_WEBHOOK_SECRET ?? "";
  return s.length >= 16 ? s : null;
}

export function getPaddleClientToken(): string | null {
  const t = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
  return /^(test|live)_[A-Za-z0-9]{10,}$/.test(t) ? t : null;
}

/** Paddle price id for a product, or null when unset/invalid. */
export function getPaddlePriceId(productId: string): string | null {
  const envName = PRICE_ENV_BY_PRODUCT[productId];
  if (!envName) return null;
  const v = (process.env[envName] ?? "").trim();
  return PRICE_ID_RE.test(v) ? v : null;
}

/** Reverse lookup used by the webhook: which product is this price? */
export function productForPriceId(priceId: string): string | null {
  for (const productId of Object.keys(PRICE_ENV_BY_PRODUCT)) {
    if (getPaddlePriceId(productId) === priceId) return productId;
  }
  return null;
}

function ready(productId: string): boolean {
  return !!getPaddleApiKey() && !!getPaddleClientToken() && getPaddlePriceId(productId) !== null;
}

/** Booleans only — safe to hand to client components. */
export function getPaddleBillingAvailability() {
  return {
    vipMonthly: ready("vip_monthly"),
    vipYearly: ready("vip_yearly"),
    tokensS: ready("starter"),
    tokensM: ready("standard"),
    tokensL: ready("whale"),
    portal: !!getPaddleApiKey(),
    webhook: !!getPaddleWebhookSecret(),
  };
}

/** Thin authenticated fetch against the Paddle API. Never logs the key. */
export async function paddleFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; code?: string }> {
  const key = getPaddleApiKey();
  if (!key) return { ok: false, status: 0, code: "not_configured" };
  try {
    const res = await fetch(`${paddleApiBase()}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Paddle-Version": "1",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as
      | { data?: T; error?: { code?: string } }
      | null;
    if (!res.ok || !json?.data) {
      return { ok: false, status: res.status, code: json?.error?.code };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, status: 0, code: "network_error" };
  }
}
