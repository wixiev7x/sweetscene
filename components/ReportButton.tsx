"use client";

import { useState } from "react";
import { createReport } from "@/lib/actions/reports";

export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: string;
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setLoading(true);
    setMessage("");

    const result = await createReport(targetType, targetId, reason);
    setLoading(false);

    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage("Report submitted. Thank you.");
      setReason("");
      setTimeout(() => {
        setOpen(false);
        setMessage("");
      }, 2000);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted hover:text-danger transition-colors"
      >
        Report
      </button>
    );
  }

  return (
    <div className="bg-surface border border-line rounded-md p-3">
      <form onSubmit={handleSubmit}>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you reporting this?"
          className="w-full bg-surface-raised border border-line rounded-md px-3 py-2 text-sm text-foreground focus:border-danger focus:outline-none mb-2"
          rows={3}
          required
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-danger text-white rounded-md px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Report"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setMessage("");
              setReason("");
            }}
            className="border border-line text-foreground-dim rounded-md px-3 py-1.5 text-xs hover:bg-surface-raised"
          >
            Cancel
          </button>
        </div>
        {message && (
          <p className="text-xs text-muted mt-2">{message}</p>
        )}
      </form>
    </div>
  );
}
