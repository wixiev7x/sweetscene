"use client";

import { useEffect, useState } from "react";
import { getSettings, setSetting } from "@/lib/actions/settings";

const DEFAULTS: Record<string, string> = {
  token_pack_500_price: "1.99",
  token_pack_2000_price: "4.99",
  token_pack_5000_price: "9.99",
  token_pack_12000_price: "19.99",
  sub_standard_price: "9.99",
  sub_premium_price: "19.99",
  currency: "USD",
};

const TOKEN_PACKS = [
  { key: "token_pack_500_price", label: "500 tokens" },
  { key: "token_pack_2000_price", label: "2000 tokens" },
  { key: "token_pack_5000_price", label: "5000 tokens" },
  { key: "token_pack_12000_price", label: "12000 tokens" },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
};

const inputClass =
  "bg-surface-raised border border-line rounded-md px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none";

export function PaymentsClient() {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({ ...DEFAULTS });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getSettings().then((result) => {
      const filtered = result.filter((s) => s.category === "payments");
      const next = { ...DEFAULTS };
      for (const s of filtered) {
        if (s.key in DEFAULTS && s.value_text) {
          next[s.key] = s.value_text;
        }
      }
      setForm(next);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      for (const [key, value] of Object.entries(form)) {
        const res = await setSetting(key, value, false, "payments");
        if (res.error) {
          setMessage({ type: "error", text: res.error });
          setSaving(false);
          return;
        }
      }
      setMessage({ type: "success", text: "Settings saved successfully." });
    } catch {
      setMessage({ type: "error", text: "Failed to save settings." });
    }
    setSaving(false);
  }

  if (loading) {
    return <p className="text-foreground-dim">Loading...</p>;
  }

  const symbol = CURRENCY_SYMBOLS[form.currency] || "$";

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Payments</h1>

      {message && (
        <div
          className={
            message.type === "success"
              ? "bg-success/10 text-success border border-success rounded-md px-4 py-3 text-sm"
              : "bg-danger/10 text-danger border border-danger rounded-md px-4 py-3 text-sm"
          }
        >
          {message.text}
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Token Packs</h2>
        {TOKEN_PACKS.map((pack) => (
          <div key={pack.key} className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-foreground">{pack.label}</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-foreground-dim">{symbol}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form[pack.key]}
                onChange={(e) => setForm({ ...form, [pack.key]: e.target.value })}
                className={inputClass + " w-28"}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Subscription Prices</h2>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-foreground">Standard (monthly)</span>
          <div className="flex items-center gap-1">
            <span className="text-sm text-foreground-dim">{symbol}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.sub_standard_price}
              onChange={(e) => setForm({ ...form, sub_standard_price: e.target.value })}
              className={inputClass + " w-28"}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-foreground">Premium (monthly)</span>
          <div className="flex items-center gap-1">
            <span className="text-sm text-foreground-dim">{symbol}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.sub_premium_price}
              onChange={(e) => setForm({ ...form, sub_premium_price: e.target.value })}
              className={inputClass + " w-28"}
            />
          </div>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Currency</h2>
        <label className="block">
          <span className="block text-sm text-foreground-dim mb-1">Currency</span>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className={inputClass}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
