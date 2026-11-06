"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  listReports,
  resolveReport,
  getMyAdminRole,
  warnUser,
  banUserTyped,
} from "@/lib/actions/admin";

type Report = {
  id: string;
  reporter_id: string;
  match_id: string;
  target_user_id: string | null;
  reason: string;
  evidence_snapshot: unknown;
  status: string;
  resolution_note: string | null;
  created_at: string;
  reporter_username: string;
  target_username: string | null;
};

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<
    "open" | "resolved" | "dismissed" | "all"
  >("open");
  const [actioning, setActioning] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "moderator" | "user">("user");

  const [warnId, setWarnId] = useState<string | null>(null);
  const [warnMessage, setWarnMessage] = useState("");

  const [banId, setBanId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");

  async function loadReports(useFilter?: string) {
    const result = await listReports(useFilter ?? filter, 50, 0);
    if (!("error" in result)) {
      setReports(result.reports);
    }
  }

  useEffect(() => {
    (async () => {
      const r = await getMyAdminRole();
      setRole(r);
      await loadReports("open");
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResolve(
    reportId: string,
    resolution: "resolved" | "dismissed"
  ) {
    setActioning(reportId);
    await resolveReport(reportId, resolution);
    setActioning(null);
    await loadReports(filter);
  }

  async function handleWarn(userId: string) {
    if (!warnMessage.trim()) {
      alert("A warning message is required.");
      return;
    }
    setActioning(userId);
    const result = await warnUser(userId, warnMessage);
    setActioning(null);
    if ("error" in result) {
      alert(result.error);
    } else {
      setWarnId(null);
      setWarnMessage("");
      alert("Warning sent.");
    }
  }

  async function handleBanTarget(userId: string) {
    if (!banReason.trim()) {
      alert("A reason is required.");
      return;
    }
    setActioning(userId);
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const result = await banUserTyped(userId, "temp", banReason, expiresAt);
    setActioning(null);
    if ("error" in result) {
      alert(result.error);
    } else {
      setBanId(null);
      setBanReason("");
      alert("User restricted for 7 days and signed out.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  const filters: ("open" | "resolved" | "dismissed" | "all")[] = [
    "open",
    "resolved",
    "dismissed",
    "all",
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-muted hover:text-foreground-dim">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Report Queue</h1>
          <span className="text-xs text-muted-faint ml-auto">
            {role === "admin" ? "Admin" : "Moderator"} view
          </span>
        </div>

        <div className="flex gap-2 mb-6">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setTimeout(() => loadReports(f), 0);
              }}
              aria-label={`Filter by ${f}`}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                filter === f
                  ? "bg-surface-raised border-line-strong text-white"
                  : "bg-surface border-line text-muted hover:border-line-strong"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {reports.length === 0 ? (
          <p className="text-muted">No reports found.</p>
        ) : (
          <div className="space-y-4">
            {reports.map((r) => {
              const isOpen = r.status === "open";
              const isExpanded = expanded === r.id;

              return (
                <div
                  key={r.id}
                  className="bg-surface border border-line rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            isOpen
                              ? "bg-red-900/50 text-red-400 border border-red-900"
                              : r.status === "resolved"
                                ? "bg-green-900/50 text-green-400 border border-green-900"
                                : "bg-surface-raised text-muted-strong border border-line-strong"
                          }`}
                        >
                          {r.status}
                        </span>
                        <span className="text-xs text-muted-faint">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                        <Link
                          href={`/chat/${r.match_id}`}
                          className="text-xs text-blue-400 hover:underline"
                        >
                          View conversation &rarr;
                        </Link>
                      </div>
                      <p className="text-sm text-foreground-dim mb-1">
                        <span className="text-muted">Reporter:</span>{" "}
                        {r.reporter_username}
                      </p>
                      {r.target_username && (
                        <p className="text-sm text-foreground-dim mb-1">
                          <span className="text-muted">Reported user:</span>{" "}
                          <span className="text-red-400/90">
                            {r.target_username}
                          </span>
                        </p>
                      )}
                      <p className="text-sm text-foreground-dim mb-2">
                        <span className="text-muted">Reason:</span> {r.reason}
                      </p>
                      {r.resolution_note && (
                        <p className="text-sm text-muted-strong">
                          <span className="text-muted">Note:</span>{" "}
                          {r.resolution_note}
                        </p>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => handleResolve(r.id, "resolved")}
                        disabled={actioning === r.id}
                        aria-label="Resolve report"
                        className="px-3 py-1.5 text-sm bg-green-900/30 border border-green-900 text-green-400 rounded-lg hover:bg-green-900/50 disabled:opacity-50"
                      >
                        {actioning === r.id ? "..." : "Resolve"}
                      </button>
                      <button
                        onClick={() => handleResolve(r.id, "dismissed")}
                        disabled={actioning === r.id}
                        aria-label="Dismiss report"
                        className="px-3 py-1.5 text-sm bg-surface-raised border border-line-strong text-muted-strong rounded-lg hover:bg-line-strong disabled:opacity-50"
                      >
                        {actioning === r.id ? "..." : "Dismiss"}
                      </button>
                      {r.target_user_id && (
                        <button
                          onClick={() => {
                            setWarnId(
                              warnId === r.target_user_id
                                ? null
                                : r.target_user_id
                            );
                            setWarnMessage("");
                            setBanId(null);
                          }}
                          aria-label="Warn reported user"
                          className="px-3 py-1.5 text-sm bg-amber-900/30 border border-amber-900 text-amber-400 rounded-lg hover:bg-amber-900/50"
                        >
                          Warn user
                        </button>
                      )}
                      {r.target_user_id && role === "admin" && (
                        <button
                          onClick={() => {
                            setBanId(
                              banId === r.target_user_id
                                ? null
                                : r.target_user_id
                            );
                            setBanReason("");
                            setWarnId(null);
                          }}
                          aria-label="Restrict reported user"
                          className="px-3 py-1.5 text-sm bg-red-900/30 border border-red-900 text-red-400 rounded-lg hover:bg-red-900/50"
                        >
                          Restrict 7d
                        </button>
                      )}
                      <button
                        onClick={() => setExpanded(isExpanded ? null : r.id)}
                        aria-label="Toggle evidence"
                        className="px-3 py-1.5 text-sm bg-surface border border-line text-muted rounded-lg hover:border-line-strong"
                      >
                        {isExpanded ? "Hide" : "Evidence"}
                      </button>
                    </div>
                  )}

                  {warnId && warnId === r.target_user_id && (
                    <div className="mt-3 p-3 bg-surface-sunken border border-line rounded-lg space-y-2">
                      <label className="text-xs text-muted block">
                        Warning message (sent as a notification, logged)
                      </label>
                      <textarea
                        value={warnMessage}
                        onChange={(e) => setWarnMessage(e.target.value)}
                        placeholder="Explain which rule was broken and what happens next..."
                        rows={2}
                        className="w-full px-3 py-2 text-sm bg-surface border border-line rounded-lg focus:border-line-focus focus:outline-none resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleWarn(r.target_user_id!)}
                          disabled={actioning === r.target_user_id}
                          className="px-4 py-1.5 text-sm bg-amber-900/50 border border-amber-900 text-amber-400 rounded-lg hover:bg-amber-900/70 disabled:opacity-30"
                        >
                          Send warning
                        </button>
                        <button
                          onClick={() => setWarnId(null)}
                          className="px-4 py-1.5 text-sm text-muted hover:text-foreground-dim"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {banId && banId === r.target_user_id && (
                    <div className="mt-3 p-3 bg-surface-sunken border border-line rounded-lg space-y-2">
                      <label className="text-xs text-muted block">
                        Reason for a 7-day restriction (required, logged; the
                        user is signed out immediately)
                      </label>
                      <textarea
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        placeholder="Reason for the restriction..."
                        rows={2}
                        className="w-full px-3 py-2 text-sm bg-surface border border-line rounded-lg focus:border-line-focus focus:outline-none resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleBanTarget(r.target_user_id!)}
                          disabled={actioning === r.target_user_id}
                          className="px-4 py-1.5 text-sm bg-red-900/50 border border-red-900 text-red-400 rounded-lg hover:bg-red-900/70 disabled:opacity-30"
                        >
                          Restrict for 7 days
                        </button>
                        <button
                          onClick={() => setBanId(null)}
                          className="px-4 py-1.5 text-sm text-muted hover:text-foreground-dim"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-3 p-3 bg-surface-sunken border border-line rounded-lg overflow-x-auto">
                      <pre className="text-xs text-muted-strong max-h-60 overflow-y-auto">
                        {JSON.stringify(r.evidence_snapshot, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
