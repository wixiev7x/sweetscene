"use client";

import { useEffect, useState } from "react";
import { listReports, setReportStatus } from "@/lib/actions/reports";
import type { ReportRecord } from "@/lib/types";

type StatusFilter = "all" | "open" | "approved" | "dismissed";

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Approved", value: "approved" },
  { label: "Dismissed", value: "dismissed" },
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "bg-warning/10 text-warning border border-warning/20";
    case "approved":
      return "bg-success/10 text-success border border-success/20";
    case "dismissed":
      return "bg-muted/10 text-muted border border-muted/20";
    default:
      return "bg-muted/10 text-muted border border-muted/20";
  }
}

export function ReportsClient() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listReports(filter, 0).then((data) => {
      if (!cancelled) {
        setReports(data ?? []);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  function handleFilterChange(value: StatusFilter) {
    setLoading(true);
    setFilter(value);
  }

  async function handleAction(id: string, status: "approved" | "dismissed") {
    const confirmed = window.confirm(
      `Are you sure you want to ${status === "approved" ? "approve" : "dismiss"} this report?`,
    );
    if (!confirmed) return;
    const result = await setReportStatus(id, status);
    if (result?.error) {
      window.alert(result.error);
      return;
    }
    const data = await listReports(filter, 0);
    setReports(data ?? []);
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-brand text-foreground"
                : "bg-surface border border-line text-foreground-dim hover:border-line-strong"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-foreground-dim">Loading...</p>
      ) : reports.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg p-8 text-center">
          <p className="text-muted">No reports found</p>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wide font-medium">Type</th>
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wide font-medium">Reason</th>
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wide font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wide font-medium">Created</th>
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wide font-medium">Reviewed By</th>
                <th className="text-right px-4 py-3 text-xs text-muted uppercase tracking-wide font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <span className="inline-block bg-surface-raised border border-line rounded-md px-2 py-1 text-xs text-foreground-dim">
                      {report.target_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{report.reason ?? "\u2014"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${statusBadgeClass(report.status)}`}
                    >
                      {report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground-dim">
                    {new Date(report.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-foreground-dim">{report.reviewed_by ?? "\u2014"}</td>
                  <td className="px-4 py-3 text-right">
                    {report.status === "open" && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleAction(report.id, "approved")}
                          className="bg-success/10 text-success border border-success/20 rounded-md px-3 py-1 text-xs font-medium hover:bg-success/20 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(report.id, "dismissed")}
                          className="bg-danger/10 text-danger border border-danger/20 rounded-md px-3 py-1 text-xs font-medium hover:bg-danger/20 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
