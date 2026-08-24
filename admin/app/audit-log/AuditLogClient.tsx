"use client";

import { useEffect, useState } from "react";
import { listAuditLogs } from "@/lib/actions/audit";
import type { AuditLogRecord } from "@/lib/types";

type ActionFilter =
  | "all"
  | "banned_user"
  | "unbanned_user"
  | "set_setting"
  | "demoted_moderator"
  | "approved_report"
  | "dismissed_report";

const ACTIONS: { label: string; value: ActionFilter }[] = [
  { label: "All actions", value: "all" },
  { label: "banned_user", value: "banned_user" },
  { label: "unbanned_user", value: "unbanned_user" },
  { label: "set_setting", value: "set_setting" },
  { label: "demoted_moderator", value: "demoted_moderator" },
  { label: "approved_report", value: "approved_report" },
  { label: "dismissed_report", value: "dismissed_report" },
];

export function AuditLogClient() {
  const [filter, setFilter] = useState<ActionFilter>("all");
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listAuditLogs(filter === "all" ? null : filter, 0).then((data) => {
      if (!cancelled) {
        setLogs(data ?? []);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  function handleFilterChange(value: ActionFilter) {
    setLoading(true);
    setFilter(value);
  }

  return (
    <div>
      <div className="mb-6">
        <select
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value as ActionFilter)}
          className="bg-surface-raised border border-line rounded-md px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
        >
          {ACTIONS.map((action) => (
            <option key={action.value} value={action.value}>
              {action.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-foreground-dim">Loading...</p>
      ) : logs.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg p-8 text-center">
          <p className="text-muted">No audit log entries</p>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wide font-medium">Action</th>
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wide font-medium">Entity Type</th>
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wide font-medium">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wide font-medium">Actor</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <span className="inline-block bg-brand/10 text-brand border border-brand/20 rounded-md px-2 py-1 text-xs font-medium">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{log.entity_type ?? "\u2014"}</td>
                  <td className="px-4 py-3 text-foreground-dim">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-foreground-dim font-mono text-xs">
                    {log.actor_id ? log.actor_id.slice(0, 8) : "\u2014"}
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
