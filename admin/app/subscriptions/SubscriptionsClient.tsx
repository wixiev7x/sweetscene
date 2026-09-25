"use client";

import { useCallback, useEffect, useState } from "react";
import { getSubscriptionRecords } from "@/lib/actions/payments-records";
import type { SubscriptionRecord } from "@/lib/types";

const inputClass =
  "bg-surface-raised border border-line rounded-md px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function SubscriptionsClient() {
  const [records, setRecords] = useState<SubscriptionRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (term: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await getSubscriptionRecords(term || undefined);
      setRecords(result);
    } catch {
      setError("Failed to load subscriptions.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
      <p className="text-sm text-foreground-dim">
        Active VIP memberships — monthly and yearly subscriptions plus stacked
        one-time passes. Renewal-based: members are reminded a few days before the
        period ends; one payment extends it. Nothing is ever auto-charged.
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search member…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") load(search);
          }}
          className={inputClass + " w-64"}
        />
        <button
          onClick={() => load(search)}
          className="bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-brand-dark"
        >
          Search
        </button>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger border border-danger rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-foreground-dim">
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Renews by</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Paid to date</th>
              <th className="px-3 py-2 font-medium text-right">Payments</th>
              <th className="px-3 py-2 font-medium">Last payment</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-foreground-dim">
                  Loading…
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-foreground-dim">
                  No active VIP members found.
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.user_id} className="border-b border-line/50">
                  <td className="px-3 py-2">
                    {r.username ?? r.user_id.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">{r.plan_label}</td>
                  <td className="px-3 py-2">{formatDate(r.vip_expires_at)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === "expiring_soon"
                          ? "bg-warning/10 text-warning"
                          : "bg-success/10 text-success"
                      }`}
                    >
                      {r.status === "expiring_soon"
                        ? "renews in ≤3 days"
                        : "active"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    ${r.total_paid.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">{r.payments_count}</td>
                  <td className="px-3 py-2 text-xs text-foreground-dim">
                    {formatDate(r.last_payment_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
