"use client"

import { Fragment, useState } from "react"
import type { AdminUser, BanRecord, UserRole } from "@/lib/types"
import {
  searchUsers,
  searchUsersByEmail,
  banUser,
  unbanUser,
  getBanHistory,
} from "@/lib/actions/users"

type SearchMode = "username" | "email"

const BAN_DURATIONS = [
  { label: "Permanent", value: "" },
  { label: "1 hour", value: "1h" },
  { label: "24 hours", value: "24h" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
]

const inputClass =
  "bg-surface-raised border border-line rounded-md px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none w-full"
const primaryButtonClass =
  "bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
const dangerButtonClass =
  "bg-danger text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
const ghostButtonClass =
  "border border-line text-foreground-dim rounded-md px-4 py-2 text-sm hover:bg-surface-raised transition-colors"

function computeExpiresAt(value: string): string | null {
  if (value === "") return null
  const now = new Date()
  const ms: Record<string, number> = {
    "1h": 3600000,
    "24h": 86400000,
    "7d": 604800000,
    "30d": 2592000000,
  }
  return new Date(now.getTime() + ms[value]).toISOString()
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return iso
  }
}

function RoleBadge({ role }: { role: UserRole }) {
  if (role === "super_admin") {
    return (
      <span className="px-2 py-0.5 rounded-md bg-brand/10 text-brand text-xs font-medium">
        super_admin
      </span>
    )
  }
  if (role === "moderator") {
    return (
      <span className="px-2 py-0.5 rounded-md bg-surface-raised text-foreground-dim text-xs font-medium">
        moderator
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-md bg-surface-raised text-muted text-xs font-medium">
      {role}
    </span>
  )
}

export function UsersClient({ role }: { role: UserRole }) {
  const [searchMode, setSearchMode] = useState<SearchMode>("username")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AdminUser[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [actionUserId, setActionUserId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<"ban" | "unban" | null>(null)
  const [reason, setReason] = useState("")
  const [duration, setDuration] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [historyUserId, setHistoryUserId] = useState<string | null>(null)
  const [historyRecords, setHistoryRecords] = useState<BanRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  function closeAction() {
    setActionUserId(null)
    setActionType(null)
    setReason("")
    setDuration("")
    setActionError(null)
  }

  function openBan(userId: string) {
    setHistoryUserId(null)
    setActionUserId(userId)
    setActionType("ban")
    setReason("")
    setDuration("")
    setActionError(null)
  }

  function openUnban(userId: string) {
    setHistoryUserId(null)
    setActionUserId(userId)
    setActionType("unban")
    setReason("")
    setActionError(null)
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    closeAction()
    setHistoryUserId(null)
    try {
      const res =
        searchMode === "email"
          ? await searchUsersByEmail(q)
          : await searchUsers(q)
      setResults(res)
    } catch {
      setError("Failed to search users. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleBan(userId: string) {
    if (!reason.trim()) {
      setActionError("Reason is required")
      return
    }
    const durLabel =
      BAN_DURATIONS.find((d) => d.value === duration)?.label ?? "Permanent"
    const ok = window.confirm(
      duration === ""
        ? "Ban this user permanently?"
        : `Ban this user for ${durLabel}?`
    )
    if (!ok) return
    setActionLoading(true)
    setActionError(null)
    try {
      const expiresAt = computeExpiresAt(duration)
      const res = await banUser(userId, reason.trim(), expiresAt)
      if (res.error) {
        setActionError(res.error)
      } else {
        setResults((prev) =>
          prev
            ? prev.map((u) =>
                u.id === userId
                  ? {
                      ...u,
                      is_banned: true,
                      ban_reason: reason.trim(),
                      banned_at: new Date().toISOString(),
                    }
                  : u
              )
            : prev
        )
        closeAction()
      }
    } catch {
      setActionError("Failed to ban user")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUnban(userId: string) {
    if (!reason.trim()) {
      setActionError("Reason is required")
      return
    }
    const ok = window.confirm("Unban this user?")
    if (!ok) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await unbanUser(userId, reason.trim())
      if (res.error) {
        setActionError(res.error)
      } else {
        setResults((prev) =>
          prev
            ? prev.map((u) =>
                u.id === userId
                  ? { ...u, is_banned: false, ban_reason: null, banned_at: null }
                  : u
              )
            : prev
        )
        closeAction()
      }
    } catch {
      setActionError("Failed to unban user")
    } finally {
      setActionLoading(false)
    }
  }

  async function toggleHistory(userId: string) {
    if (historyUserId === userId) {
      setHistoryUserId(null)
      return
    }
    closeAction()
    setHistoryUserId(userId)
    setHistoryLoading(true)
    try {
      const records = await getBanHistory(userId)
      setHistoryRecords(records)
    } catch {
      setHistoryRecords([])
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Users</h1>
        <p className="text-sm text-muted mt-1">
          Search and moderate user accounts.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSearchMode("username")}
          className={
            searchMode === "username"
              ? "bg-brand text-white rounded-md px-4 py-2 text-sm font-medium"
              : ghostButtonClass
          }
        >
          Search by username
        </button>
        {role === "super_admin" && (
          <button
            type="button"
            onClick={() => setSearchMode("email")}
            className={
              searchMode === "email"
                ? "bg-brand text-white rounded-md px-4 py-2 text-sm font-medium"
                : ghostButtonClass
            }
          >
            Search by email
          </button>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            searchMode === "email" ? "Enter email..." : "Enter username..."
          }
          className={inputClass}
        />
        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <p className="text-danger text-sm">{error}</p>}

      {results !== null && results.length === 0 && !loading && (
        <p className="text-muted text-sm">No users found</p>
      )}

      {results !== null && results.length > 0 && (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-surface-raised">
                <th className="px-4 py-2 text-left text-xs font-medium text-foreground-dim">
                  Username
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-foreground-dim">
                  Email
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-foreground-dim">
                  Role
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-foreground-dim">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-foreground-dim">
                  Joined
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-foreground-dim">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((user) => (
                <Fragment key={user.id}>
                  <tr className="border-b border-line">
                    <td className="px-4 py-3 text-sm text-foreground">
                      {user.username ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground-dim">
                      {user.email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-4 py-3">
                      {user.is_banned ? (
                        <span className="px-2 py-0.5 rounded-md bg-surface-raised text-danger text-xs font-medium">
                          Banned
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-surface-raised text-success text-xs font-medium">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground-dim">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {user.is_banned ? (
                          <button
                            type="button"
                            onClick={() => openUnban(user.id)}
                            className={ghostButtonClass}
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openBan(user.id)}
                            className={dangerButtonClass}
                          >
                            Ban
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleHistory(user.id)}
                          className={ghostButtonClass}
                        >
                          History
                        </button>
                      </div>
                    </td>
                  </tr>

                  {actionUserId === user.id && actionType === "ban" && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-4 bg-surface-raised border-b border-line"
                      >
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-foreground-dim text-sm">
                              Ban reason
                            </label>
                            <input
                              type="text"
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="Reason for ban"
                              className={inputClass}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-foreground-dim text-sm">
                              Duration
                            </label>
                            <select
                              value={duration}
                              onChange={(e) => setDuration(e.target.value)}
                              className={inputClass}
                            >
                              {BAN_DURATIONS.map((d) => (
                                <option key={d.label} value={d.value}>
                                  {d.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          {actionError && (
                            <p className="text-danger text-sm">{actionError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleBan(user.id)}
                              className={dangerButtonClass}
                            >
                              {actionLoading ? "Banning..." : "Confirm Ban"}
                            </button>
                            <button
                              type="button"
                              onClick={closeAction}
                              className={ghostButtonClass}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {actionUserId === user.id && actionType === "unban" && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-4 bg-surface-raised border-b border-line"
                      >
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-foreground-dim text-sm">
                              Unban reason
                            </label>
                            <input
                              type="text"
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="Reason for unban"
                              className={inputClass}
                            />
                          </div>
                          {actionError && (
                            <p className="text-danger text-sm">{actionError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleUnban(user.id)}
                              className={primaryButtonClass}
                            >
                              {actionLoading ? "Unbanning..." : "Confirm Unban"}
                            </button>
                            <button
                              type="button"
                              onClick={closeAction}
                              className={ghostButtonClass}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {historyUserId === user.id && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-4 bg-surface-raised border-b border-line"
                      >
                        {historyLoading ? (
                          <p className="text-muted text-sm">
                            Loading history...
                          </p>
                        ) : historyRecords.length === 0 ? (
                          <p className="text-muted text-sm">No ban history</p>
                        ) : (
                          <div className="space-y-2">
                            {historyRecords.map((record) => (
                              <div
                                key={record.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                              >
                                <span
                                  className={
                                    record.active
                                      ? "px-2 py-0.5 rounded-md bg-surface-raised text-danger text-xs font-medium"
                                      : "px-2 py-0.5 rounded-md bg-surface-raised text-success text-xs font-medium"
                                  }
                                >
                                  {record.active ? "Active" : "Lifted"}
                                </span>
                                <span className="text-foreground">
                                  {record.reason}
                                </span>
                                <span className="text-muted">
                                  {formatDate(record.created_at)}
                                  {record.expires_at &&
                                    ` · expires ${formatDate(record.expires_at)}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
