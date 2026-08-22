"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAdmin, listReports, resolveReport } from "@/lib/actions/admin";

type Report = {
  id: string;
  reporter_id: string;
  match_id: string;
  reason: string;
  evidence_snapshot: unknown;
  status: string;
  resolution_note: string | null;
  created_at: string;
  reporter_username: string;
};

export default function AdminReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<"open" | "resolved" | "dismissed" | "all">("open");
  const [actioning, setActioning] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function loadReports(useFilter?: string) {
    const result = await listReports(useFilter ?? filter, 50, 0);
    if (!("error" in result)) {
      setReports(result.reports);
    }
  }

  useEffect(() => {
    (async () => {
      const admin = await isAdmin();
      if (!admin) {
        router.replace("/lobby");
        return;
      }
      setAuthorized(true);
      await loadReports("open");
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleResolve(
    reportId: string,
    resolution: "resolved" | "dismissed"
  ) {
    setActioning(reportId);
    await resolveReport(reportId, resolution);
    setActioning(null);
    await loadReports(filter);
  }

  if (!authorized || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  const filters: ("open" | "resolved" | "dismissed" | "all")[] = [
    "open",
    "resolved",
    "dismissed",
    "all",
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-muted hover:text-foreground-dim">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Report Queue</h1>
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
                      </div>
                      <p className="text-sm text-foreground-dim mb-1">
                        <span className="text-muted">Reporter:</span>{" "}
                        {r.reporter_username}
                      </p>
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
                    <div className="flex gap-2 mt-3">
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
                      <button
                        onClick={() => setExpanded(isExpanded ? null : r.id)}
                        aria-label="Toggle evidence"
                        className="px-3 py-1.5 text-sm bg-surface border border-line text-muted rounded-lg hover:border-line-strong"
                      >
                        {isExpanded ? "Hide" : "Evidence"}
                      </button>
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
    </main>
  );
}