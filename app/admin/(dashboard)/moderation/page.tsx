"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  listModerationQueue,
  resolveModerationItem,
} from "@/lib/actions/admin";

type QueueItem = {
  id: string;
  content_type: string;
  content_id: string;
  reported_by: string | null;
  reason: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const CONTENT_TYPES = ["all", "character", "bot", "bounty", "confession", "message"];
const STATUSES = ["pending", "approved", "removed"];

export default function AdminModerationPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("all");
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await listModerationQueue(
        statusFilter,
        typeFilter === "all" ? null : typeFilter,
        100,
        0
      );
      if (!cancelled && !("error" in result)) {
        setItems(result.items);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [statusFilter, typeFilter]);

  async function handleFilterChange(
    newStatus: string,
    newType: string
  ) {
    setLoading(true);
    const result = await listModerationQueue(
      newStatus,
      newType === "all" ? null : newType,
      100,
      0
    );
    if (!("error" in result)) {
      setItems(result.items);
    }
    setLoading(false);
  }

  async function handleResolve(
    itemId: string,
    resolution: "approved" | "removed"
  ) {
    const verb = resolution === "approved" ? "approve" : "remove";
    if (!confirm(`Are you sure you want to ${verb} this item?`)) return;
    setActioning(itemId);
    const result = await resolveModerationItem(itemId, resolution);
    setActioning(null);
    if ("error" in result) {
      alert(result.error);
    } else {
      const res = await listModerationQueue(
        statusFilter,
        typeFilter === "all" ? null : typeFilter,
        100,
        0
      );
      if (!("error" in res)) {
        setItems(res.items);
      }
    }
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
          <h1 className="text-2xl font-bold">Moderation Queue</h1>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  handleFilterChange(s, typeFilter);
                }}
                className={`px-3 py-1.5 text-sm rounded-lg border capitalize ${
                  statusFilter === s
                    ? "bg-brand-deep text-brand-light border-brand"
                    : "bg-surface text-muted border-line"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {CONTENT_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTypeFilter(t);
                  handleFilterChange(statusFilter, t);
                }}
                className={`px-3 py-1.5 text-sm rounded-lg border capitalize ${
                  typeFilter === t
                    ? "bg-brand-deep text-brand-light border-brand"
                    : "bg-surface text-muted border-line"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-muted">No items in this view.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-surface border border-line rounded-lg p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-xs bg-surface-raised text-muted-faint capitalize">
                        {item.content_type}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs capitalize ${
                          item.status === "pending"
                            ? "bg-amber-900/50 text-amber-400"
                            : item.status === "approved"
                              ? "bg-green-900/50 text-green-400"
                              : "bg-red-900/50 text-red-400"
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="text-xs text-muted-faint">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground-dim mb-1">
                      <span className="text-muted">Reason:</span>{" "}
                      {item.reason}
                    </p>
                    <p className="text-xs text-muted-faint">
                      Content ID: {item.content_id}
                      {item.reported_by &&
                        ` · Reported by: ${item.reported_by}`}
                      {item.reviewed_at &&
                        ` · Reviewed: ${new Date(item.reviewed_at).toLocaleString()}`}
                    </p>
                  </div>

                  {item.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleResolve(item.id, "approved")}
                        disabled={actioning === item.id}
                        className="px-3 py-1.5 text-sm bg-green-900/30 border border-green-900 text-green-400 rounded-lg hover:bg-green-900/50 disabled:opacity-30"
                      >
                        {actioning === item.id ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => handleResolve(item.id, "removed")}
                        disabled={actioning === item.id}
                        className="px-3 py-1.5 text-sm bg-red-900/30 border border-red-900 text-red-400 rounded-lg hover:bg-red-900/50 disabled:opacity-30"
                      >
                        {actioning === item.id ? "..." : "Remove"}
                      </button>
                    </div>
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
