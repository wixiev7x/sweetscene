"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { createInvoice } from "@/lib/nowpayments/server";
import { rateLimit } from "@/lib/utils/ratelimit";
import { randomUUID } from "node:crypto";
import { logger } from "@/lib/utils/logger";
import {
  TOKEN_PACKAGES,
  DYNAMIC_TOKEN_RATE_USD,
  VIP_PRICE_USD,
} from "@/lib/billing/constants";

/* ════════════════════════════════════════════════════════════════════
 * Phase 8 — Billing server actions.
 *
 * Creates NOWPayments invoices for VIP passes and token purchases.
 * All actions are auth-checked: the user client verifies the session
 * via supabase.auth.getUser() before the admin client writes the
 * payment row.
 * ════════════════════════════════════════════════════════════════════ */

/**
 * Minimum and maximum token quantities for dynamic purchases.
 */
const MIN_TOKENS = 1000;
const MAX_TOKENS = 1_000_000;

type BillingResult =
  | { invoiceUrl: string }
  | { error: string };

/**
 * Creates a NOWPayments invoice for a 30-day VIP pass. After successful
 * payment, the webhook calls grant_vip to activate the pass. The
 * payment row is inserted as 'pending' and updated to 'confirmed' by
 * the webhook.
 *
 * @returns The hosted invoice URL for redirect, or an error.
 */
export async function createVIPOrder(): Promise<BillingResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Too many requests. Slow down." };
  }

  const orderId = `vip-${randomUUID()}`;
  const admin = createAdminClient();

  const { error: insertError } = await admin.from("payments").insert({
    order_id: orderId,
    user_id: user.id,
    type: "vip",
    status: "pending",
    amount: VIP_PRICE_USD,
    currency: "usd",
  });

  if (insertError) return { error: "Failed to create order" };

  try {
    const invoice = await createInvoice({
      priceAmount: VIP_PRICE_USD,
      priceCurrency: "usd",
      orderId,
      orderDescription: "VIP 30-day pass",
    });

    return { invoiceUrl: invoice.invoice_url };
  } catch (err) {
    logger.error("invoice_create_failed", { kind: "vip", orderId, err });
    /* BUG 13: mark the pending row as 'failed' so it doesn't linger. */
    await admin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("order_id", orderId);
    return { error: "Failed to create payment invoice" };
  }
}

/**
 * Creates a NOWPayments invoice for a token purchase with a dynamic
 * quantity. The price is computed at DYNAMIC_TOKEN_RATE_USD per token.
 * Used by the solo-play paywall modal "Top Up" button.
 *
 * @param quantity - Number of tokens to purchase (1000–1,000,000).
 * @returns The hosted invoice URL for redirect, or an error.
 */
export async function createTokenOrder(quantity: number): Promise<BillingResult> {
  /* Price is ALWAYS derived server-side from the quantity. See the
     note on `placeTokenOrder` for why it may never be a parameter of
     an exported action. */
  const priceUsd = Math.round(quantity * DYNAMIC_TOKEN_RATE_USD * 100) / 100;
  return placeTokenOrder(quantity, priceUsd);
}

/**
 * Module-private order placement.
 *
 * SECURITY: this takes `priceUsd` as a parameter, and that is only safe
 * because it is NOT exported. Every export from a `"use server"` module
 * is a client-callable RPC endpoint whose arguments come off the wire —
 * so when the price override lived on the exported `createTokenOrder`,
 * a client could call it directly with a price of its choosing and buy
 * 1,000,000 tokens for one cent. Callers here are trusted, in-process,
 * and pass a price they computed from server-side constants.
 *
 * Do not export this function, and do not add a price parameter to
 * anything that is exported.
 */
async function placeTokenOrder(
  quantity: number,
  priceUsd: number
): Promise<BillingResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!(await rateLimit(user.id))) {
    return { error: "Too many requests. Slow down." };
  }

  if (!Number.isInteger(quantity) || quantity < MIN_TOKENS || quantity > MAX_TOKENS) {
    return { error: `Quantity must be between ${MIN_TOKENS} and ${MAX_TOKENS}` };
  }

  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    return { error: "Invalid price calculation" };
  }

  const orderId = `tokens-${randomUUID()}`;
  const admin = createAdminClient();

  /* E2: dedup — check for an existing pending token order for this user.
     If one exists, reuse its invoice URL rather than creating a new one. */
  const { data: existingPending } = await admin
    .from("payments")
    .select("order_id")
    .eq("user_id", user.id)
    .eq("type", "tokens")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPending) {
    /* Mark the old pending row as expired — don't reuse NOWPayments
       invoices as they may have expired on their side. */
    await admin
      .from("payments")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("order_id", (existingPending as Record<string, unknown>).order_id as string);
  }

  const { error: insertError } = await admin.from("payments").insert({
    order_id: orderId,
    user_id: user.id,
    type: "tokens",
    status: "pending",
    amount: priceUsd,
    currency: "usd",
    token_quantity: quantity,
  });

  if (insertError) return { error: "Failed to create order" };

  try {
    const invoice = await createInvoice({
      priceAmount: priceUsd,
      priceCurrency: "usd",
      orderId,
      orderDescription: `${quantity.toLocaleString()} tokens`,
    });

    return { invoiceUrl: invoice.invoice_url };
  } catch (err) {
    logger.error("invoice_create_failed", { kind: "tokens", orderId, err });
    await admin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("order_id", orderId);
    return { error: "Failed to create payment invoice" };
  }
}

/**
 * Creates a NOWPayments invoice for a fixed token package. Used by the
 * profile page purchase buttons. Delegates to createTokenOrder with
 * the package's token quantity.
 *
 * @param packageId - One of 'starter', 'standard', 'whale'.
 * @returns The hosted invoice URL for redirect, or an error.
 */
export async function createTokenPackageOrder(
  packageId: string
): Promise<BillingResult> {
  /* `packageId` is attacker-controlled; the price is looked up from the
     server-side table, never taken from the caller. */
  const pkg = TOKEN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return { error: "Invalid package" };

  /* E1: charge the package's advertised price, not the dynamic rate. */
  return placeTokenOrder(pkg.tokens, pkg.priceUsd);
}
