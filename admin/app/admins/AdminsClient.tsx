"use client"

import { useEffect, useState } from "react"
import type { AdminUser, UserRole } from "@/lib/types"
import { listAdmins, inviteModerator, demoteModerator } from "@/lib/actions/admins"

const inputClass =
  "bg-surface-raised border border-line rounded-md px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none w-full"
const primaryButtonClass =
  "bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
const dangerButtonClass =
  "bg-danger text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"

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
  return (
    <span className="px-2 py-0.5 rounded-md bg-surface-raised text-foreground-dim text-xs font-medium">
      {role}
    </span>
  )
}

export function AdminsClient({ role }: { role: UserRole }) {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  const [demoteLoadingId, setDemoteLoadingId] = useState<string | null>(null)
  const [demoteError, setDemoteError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setListError(null)
      try {
        const list = await listAdmins()
        if (!active) return
        setAdmins(list)
      } catch {
        if (!active) return
        setListError("Failed to load admins")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  async function reload() {
    try {
      const list = await listAdmins()
      setAdmins(list)
    } catch {
      setListError("Failed to load admins")
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(null)
    if (!email.trim() || !password) {
      setInviteError("Email and password are required")
      return
    }
    setInviteLoading(true)
    try {
      const res = await inviteModerator(email.trim(), password)
      if (res.error) {
        setInviteError(res.error)
      } else {
        setInviteSuccess(`Invited moderator: ${email.trim()}`)
        setEmail("")
        setPassword("")
        await reload()
      }
    } catch {
      setInviteError("Failed to invite moderator")
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleDemote(userId: string, username?: string) {
    const ok = window.confirm(
      `Demote ${username ?? "this moderator"} to a regular user?`
    )
    if (!ok) return
    setDemoteError(null)
    setDemoteLoadingId(userId)
    try {
      const res = await demoteModerator(userId)
      if (res.error) {
        setDemoteError(res.error)
      } else {
        await reload()
      }
    } catch {
      setDemoteError("Failed to demote moderator")
    } finally {
      setDemoteLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Admins</h1>
        <p className="text-sm text-muted mt-1">
          Manage administrators and invite moderators.
        </p>
      </div>

      <div className="bg-surface border border-line rounded-lg p-6 max-w-md">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          Invite Moderator
        </h2>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-1">
            <label className="text-foreground-dim text-sm">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-foreground-dim text-sm">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
              required
            />
          </div>
          {inviteError && (
            <p className="text-danger text-sm">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="text-success text-sm">{inviteSuccess}</p>
          )}
          <button
            type="submit"
            disabled={inviteLoading}
            className={primaryButtonClass}
          >
            {inviteLoading ? "Creating..." : "Create"}
          </button>
        </form>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {loading ? (
          <p className="px-4 py-6 text-muted text-sm">Loading admins...</p>
        ) : listError ? (
          <p className="px-4 py-6 text-danger text-sm">{listError}</p>
        ) : admins.length === 0 ? (
          <p className="px-4 py-6 text-muted text-sm">No admins found</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-surface-raised">
                <th className="px-4 py-2 text-left text-xs font-medium text-foreground-dim">
                  Username
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-foreground-dim">
                  Role
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
              {admins.map((admin) => (
                <tr key={admin.id} className="border-b border-line">
                  <td className="px-4 py-3 text-sm text-foreground">
                    {admin.username ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={admin.role} />
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground-dim">
                    {formatDate(admin.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {role === "super_admin" &&
                    admin.role !== "super_admin" ? (
                      <button
                        type="button"
                        disabled={demoteLoadingId === admin.id}
                        onClick={() =>
                          handleDemote(admin.id, admin.username)
                        }
                        className={dangerButtonClass}
                      >
                        {demoteLoadingId === admin.id
                          ? "Demoting..."
                          : "Demote"}
                      </button>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {demoteError && <p className="text-danger text-sm">{demoteError}</p>}
    </div>
  )
}
