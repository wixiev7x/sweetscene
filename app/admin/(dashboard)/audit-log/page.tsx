"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { listAuditLog } from "@/lib/actions/admin";

type LogEntry = {
  id: string;
  admin_id: string;
  action: string;
  target_id: string | null;
  target_type: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
};

const ACTION_FILTERS = [
  "all",
  "banned_user",
  "unbanned_user",
  "removed_content",
  "approved_content",
  "grant_tokens",
];

export default function AdminAuditLogPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await listAuditLog(
        actionFilter === "all" ? null : actionFilter,
        100,
        0
      );
      if (!cancelled && !("error" in result)) {
        setEntries(result.entries);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [actionFilter]);

  async function handleFilterChange(newAction: string) {
    setLoading(true);
    setActionFilter(newAction);
    const result = await listAuditLog(
      newAction === "all" ? null : newAction,
      100,
      0
    );
    if (!("error" in result)) {
      setEntries(result.entries);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin"
            className="text-muted hover:text-foreground-dim"
          >
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Audit Log</h1>
        </div>

        <div className="flex flex-wrap gap-1 mb-6">
          {ACTION_FILTERS.map((a) => (
            <button
              key={a}
              onClick={() => handleFilterChange(a)}
              className={`px-3 py-1.5 text-sm rounded-lg border capitalize ${
                actionFilter === a
                  ? "bg-brand-deep text-brand-light border-brand"
                  : "bg-surface text-muted border-line"
              }`}
            >
              {a.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {entries.length === 0 ? (
          <p className="text-muted">No audit log entries.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-surface border border-line rounded-lg p-4"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-xs bg-brand-deep/50 text-brand-light border border-brand-deep">
                    {entry.action.replace(/_/g, " ")}
                  </span>
                  {entry.target_type && (
                    <span className="px-2 py-0.5 rounded text-xs bg-surface-raised text-muted-faint capitalize">
                      {entry.target_type}
                    </span>
                  )}
                  <span className="text-xs text-muted-faint ml-auto">
                    {new Date(entry.occurred_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-foreground-dim">
                  {entry.reason || (
                    <span className="text-muted-faint">No reason recorded</span>
                  )}
                </p>
                <div className="text-xs text-muted-faint mt-1 space-x-2">
                  <span>Admin: {entry.admin_id.slice(0, 8)}...</span>
                  {entry.target_id && (
                    <span>Target: {entry.target_id.slice(0, 8)}...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
