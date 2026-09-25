"use client";

import { useCallback, useEffect, useState } from "react";
import { getPaymentRecords } from "@/lib/actions/payments-records";
import type { PaymentRecord } from "@/lib/types";

const STATUSES = ["", "pending", "confirmed", "failed", "expired", "refunded"];
const TYPES = ["", "vip", "tokens"];

const inputClass =
  "bg-surface-raised border border-line rounded-md px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none";

function statusBadgeClass(status: string): string {
  if (status === "confirmed") return "bg-success/10 text-success";
  if (status === "pending") return "bg-warning/10 text-warning";
  if (status === "refunded") return "bg-danger/10 text-danger";
  return "bg-surface-raised text-foreground-dim";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function shortId(value: string | null): string {
  if (!value) return "—";
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

export function PaymentRecordsClient() {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (offset: number, append: boolean) => {
      if (offset === 0) setLoading(true);
      setError("");
      try {
        const result = await getPaymentRecords({
          status: status || undefined,
          type: type || undefined,
          search: search || undefined,
          offset,
        });
        setTotal(result.total);
        setRecords((prev) =>
          append ? [...prev, ...result.records] : result.records
        );
      } catch {
        setError("Failed to load payment records.");
      }
      setLoading(false);
    },
    [status, type, search]
  );

  useEffect(() => {
    load(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, type]);

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
      <p className="text-sm text-foreground-dim">
        Every payment order across both rails (PayRam card checkout and NOWPayments
        crypto) — {total} total.
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search order / tx id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") load(0, false);
          }}
          className={inputClass + " w-64"}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={inputClass}
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? s : "all statuses"}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={inputClass}
        >
          {TYPES.map((t) => (
            <option key={t || "all"} value={t}>
              {t ? t : "all types"}
            </option>
          ))}
        </select>
        <button
          onClick={() => load(0, false)}
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
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
              <th className="px-3 py-2 font-medium text-right">Tokens</th>
              <th className="px-3 py-2 font-medium">Tx / ref</th>
              <th className="px-3 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && records.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-foreground-dim">
                  Loading…
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-foreground-dim">
                  No payments found.
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} className="border-b border-line/50">
                  <td className="px-3 py-2 font-mono text-xs" title={r.order_id}>
                    {shortId(r.order_id)}
                  </td>
                  <td className="px-3 py-2">
                    {r.username ?? shortId(r.user_id)}
                  </td>
                  <td className="px-3 py-2">{r.plan_label}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                        r.status
                      )}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    ${r.amount.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.token_quantity
                      ? r.token_quantity.toLocaleString()
                      : "—"}
                  </td>
                  <td
                    className="px-3 py-2 font-mono text-xs"
                    title={r.payment_id ?? ""}
                  >
                    {shortId(r.payment_id)}
                  </td>
                  <td className="px-3 py-2 text-xs text-foreground-dim">
                    {formatDate(r.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {records.length < total && (
        <button
          onClick={() => load(records.length, true)}
          className="bg-surface-raised border border-line rounded-md px-4 py-2 text-sm text-foreground hover:border-brand"
        >
          Load more ({records.length} / {total})
        </button>
      )}
    </div>
  );
}
