"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  listUsers,
  banUserTyped,
  unbanUserWithReason,
  grantTokens,
  expireBans,
  searchUsersByEmail,
  listBanHistory,
} from "@/lib/actions/admin";

type User = {
  id: string;
  anonymous_username: string;
  anonymous_pfp_url?: string | null;
  email?: string;
  reputation_score: number;
  tokens_balance: number;
  is_vip: boolean;
  is_admin: boolean;
  is_banned: boolean;
  banned_until: string | null;
  created_at: string;
  role?: string;
  is_shadowbanned?: boolean;
};

type BanHistory = {
  id: string;
  moderator_id: string | null;
  reason: string;
  banned_at: string;
  expires_at: string | null;
  active: boolean;
  type?: string;
  appeal_state?: string;
};

type BanType = "temp-7d" | "temp-30d" | "permanent" | "shadow";

const BAN_PRESETS: Array<{
  value: BanType;
  label: string;
  hint: string;
}> = [
  { value: "temp-7d", label: "7 days", hint: "Temporary restriction" },
  { value: "temp-30d", label: "30 days", hint: "Temporary restriction" },
  { value: "permanent", label: "Permanent", hint: "Full ban, no expiry" },
  {
    value: "shadow",
    label: "Shadow",
    hint: "Their messages become invisible to others — they are never told",
  },
];

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [searchMode, setSearchMode] = useState<"username" | "email">(
    "username"
  );
  const [actioning, setActioning] = useState<string | null>(null);
  const [banReasonId, setBanReasonId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banType, setBanType] = useState<BanType>("permanent");
  const [unbanReasonId, setUnbanReasonId] = useState<string | null>(null);
  const [unbanReason, setUnbanReason] = useState("");
  const [sweeping, setSweeping] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<BanHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await listUsers("", 50, 0);
      if (!cancelled && !("error" in result)) {
        setUsers(result.users as User[]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadUsers(s: string) {
    if (searchMode === "email" && s.trim()) {
      const result = await searchUsersByEmail(s);
      if (!("error" in result)) {
        setUsers(result.users as User[]);
        return;
      }
    }
    const result = await listUsers(s, 50, 0);
    if (!("error" in result)) {
      setUsers(result.users as User[]);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await loadUsers(search);
    setLoading(false);
  }

  function startBan(userId: string) {
    setBanReasonId(userId);
    setBanReason("");
    setBanType("permanent");
  }

  async function handleBan(userId: string) {
    if (!banReason.trim()) {
      alert("A reason is required.");
      return;
    }
    const type =
      banType === "shadow" ? "shadow" : banType === "permanent" ? "permanent" : "temp";
    const expiresAt =
      banType === "temp-7d"
        ? new Date(Date.now() + 7 * 86_400_000).toISOString()
        : banType === "temp-30d"
          ? new Date(Date.now() + 30 * 86_400_000).toISOString()
          : null;
    setActioning(userId);
    const result = await banUserTyped(userId, type, banReason, expiresAt);
    setActioning(null);
    if ("error" in result) {
      alert(result.error);
    } else {
      setBanReasonId(null);
      setBanReason("");
      await loadUsers(search);
    }
  }

  async function handleUnban(userId: string) {
    if (!unbanReason.trim()) {
      alert("A reason is required.");
      return;
    }
    setActioning(userId);
    const result = await unbanUserWithReason(userId, unbanReason);
    setActioning(null);
    if ("error" in result) {
      alert(result.error);
    } else {
      setUnbanReasonId(null);
      setUnbanReason("");
      await loadUsers(search);
    }
  }

  async function handleExpireBans() {
    setSweeping(true);
    const result = await expireBans();
    setSweeping(false);
    if ("error" in result) {
      alert(result.error);
    } else {
      alert(
        result.expired === 0
          ? "No restrictions had elapsed."
          : `Cleared ${result.expired} elapsed restriction(s).`
      );
      await loadUsers(search);
    }
  }

  async function handleGrantTokens(userId: string) {
    const input = prompt(
      "Token amount (positive to grant, negative to deduct):"
    );
    if (!input) return;
    const amount = parseInt(input, 10);
    if (isNaN(amount) || amount === 0) {
      alert("Enter a non-zero integer.");
      return;
    }
    setActioning(userId);
    await grantTokens(userId, amount);
    setActioning(null);
    await loadUsers(search);
  }

  async function handleViewHistory(userId: string) {
    if (historyId === userId) {
      setHistoryId(null);
      setHistory([]);
      return;
    }
    setHistoryId(userId);
    setHistoryLoading(true);
    setHistory([]);
    const result = await listBanHistory(userId);
    if (!("error" in result)) {
      setHistory(result.bans);
    }
    setHistoryLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <Link
            href="/admin"
            className="text-muted hover:text-foreground-dim"
          >
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold">User Management</h1>
          <button
            onClick={handleExpireBans}
            disabled={sweeping}
            title="Clear the banned flag on restrictions whose expiry has already passed"
            className="ml-auto px-3 py-1.5 text-sm bg-surface border border-line rounded-lg hover:border-line-strong disabled:opacity-40"
          >
            {sweeping ? "Sweeping..." : "Sweep expired"}
          </button>
        </div>

        <div className="mb-3 flex gap-2 text-sm">
          <button
            onClick={() => {
              setSearchMode("username");
              setSearch("");
            }}
            className={`px-3 py-1 rounded-lg border ${
              searchMode === "username"
                ? "bg-brand-deep text-brand-light border-brand"
                : "bg-surface text-muted border-line"
            }`}
          >
            Search by username
          </button>
          <button
            onClick={() => {
              setSearchMode("email");
              setSearch("");
            }}
            className={`px-3 py-1 rounded-lg border ${
              searchMode === "email"
                ? "bg-brand-deep text-brand-light border-brand"
                : "bg-surface text-muted border-line"
            }`}
          >
            Search by email
          </button>
        </div>

        <form onSubmit={handleSearch} className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              searchMode === "email"
                ? "Search by email..."
                : "Search by username..."
            }
            aria-label="Search users"
            className="w-full px-4 py-2 bg-surface border border-line rounded-lg focus:border-line-focus focus:outline-none"
          />
        </form>

        {users.length === 0 ? (
          <p className="text-muted">No users found.</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="bg-surface border border-line rounded-lg p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {u.anonymous_username}
                        </p>
                        {u.email && (
                          <span className="text-xs text-muted-faint">
                            {u.email}
                          </span>
                        )}
                        {u.is_admin && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-brand-deep/50 text-brand-light border border-brand-deep">
                            Admin
                          </span>
                        )}
                        {!u.is_admin && u.role === "moderator" && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-blue-900/50 text-blue-400 border border-blue-900">
                            Moderator
                          </span>
                        )}
                        {u.is_vip && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-amber-900/50 text-amber-400 border border-amber-900">
                            VIP
                          </span>
                        )}
                        {u.is_shadowbanned && (
                          <span
                            className="px-1.5 py-0.5 rounded text-xs bg-purple-900/50 text-purple-400 border border-purple-900"
                            title="Shadowbanned — their messages are invisible to other users"
                          >
                            Shadow
                          </span>
                        )}
                        {u.is_banned &&
                          (u.banned_until ? (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-orange-900/50 text-orange-400 border border-orange-900">
                              Restricted until{" "}
                              {new Date(u.banned_until).toLocaleString()}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-red-900/50 text-red-400 border border-red-900">
                              Banned
                            </span>
                          ))}
                      </div>
                      <p className="text-xs text-muted-faint mt-1">
                        {u.tokens_balance.toLocaleString()} tokens
                        &middot; Rep: {u.reputation_score} &middot;{" "}
                        {new Date(u.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <button
                      onClick={() => handleGrantTokens(u.id)}
                      disabled={
                        actioning === u.id ||
                        u.is_admin ||
                        u.role === "moderator"
                      }
                      aria-label="Adjust tokens"
                      className="px-3 py-1.5 text-sm bg-blue-900/30 border border-blue-900 text-blue-400 rounded-lg hover:bg-blue-900/50 disabled:opacity-30"
                    >
                      Tokens
                    </button>
                    <button
                      onClick={() => handleViewHistory(u.id)}
                      aria-label="View ban history"
                      className="px-3 py-1.5 text-sm bg-surface-raised border border-line-strong text-muted rounded-lg hover:text-foreground-dim"
                    >
                      {historyId === u.id ? "Hide" : "History"}
                    </button>
                    {u.is_banned || u.is_shadowbanned ? (
                      <button
                        onClick={() => {
                          setUnbanReasonId(u.id);
                          setUnbanReason("");
                        }}
                        disabled={
                          actioning === u.id ||
                          u.is_admin ||
                          u.role === "moderator"
                        }
                        aria-label="Unban user"
                        className="px-3 py-1.5 text-sm bg-green-900/30 border border-green-900 text-green-400 rounded-lg hover:bg-green-900/50 disabled:opacity-30"
                      >
                        Unban
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => startBan(u.id)}
                          disabled={
                            actioning === u.id ||
                            u.is_admin ||
                            u.role === "moderator"
                          }
                          aria-label="Ban user"
                          className="px-3 py-1.5 text-sm bg-red-900/30 border border-red-900 text-red-400 rounded-lg hover:bg-red-900/50 disabled:opacity-30"
                        >
                          Ban
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {banReasonId === u.id &&
                  !u.is_banned &&
                  !u.is_shadowbanned && (
                    <div className="mt-3 pt-3 border-t border-line space-y-3">
                      <div>
                        <label className="text-xs text-muted block mb-1">
                          Reason (required, recorded in the audit log)
                        </label>
                        <textarea
                          value={banReason}
                          onChange={(e) => setBanReason(e.target.value)}
                          placeholder="Reason for this ban..."
                          rows={2}
                          className="w-full px-3 py-2 text-sm bg-surface-sunken border border-line rounded-lg focus:border-line-focus focus:outline-none resize-none"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted mr-1">Type:</span>
                        {BAN_PRESETS.map((p) => (
                          <button
                            key={p.value}
                            onClick={() => setBanType(p.value)}
                            title={p.hint}
                            className={`px-3 py-1 text-xs rounded-lg border ${
                              banType === p.value
                                ? p.value === "shadow"
                                  ? "bg-purple-900/50 text-purple-400 border-purple-900"
                                  : p.value === "permanent"
                                    ? "bg-red-900/50 text-red-400 border-red-900"
                                    : "bg-orange-900/50 text-orange-400 border-orange-900"
                                : "bg-surface-raised border-line-strong text-muted"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      {banType === "shadow" && (
                        <p className="text-xs text-purple-400/80">
                          Shadow ban: the user is never blocked or notified —
                          their messages simply stop being visible to everyone
                          else.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleBan(u.id)}
                          disabled={actioning === u.id}
                          className="px-4 py-1.5 text-sm bg-red-900/50 border border-red-900 text-red-400 rounded-lg hover:bg-red-900/70 disabled:opacity-30"
                        >
                          {actioning === u.id
                            ? "Banning..."
                            : banType === "shadow"
                              ? "Apply shadow ban"
                              : banType === "permanent"
                                ? "Ban permanently"
                                : `Restrict for ${banType === "temp-7d" ? "7 days" : "30 days"}`}
                        </button>
                        <button
                          onClick={() => {
                            setBanReasonId(null);
                            setBanReason("");
                          }}
                          className="px-4 py-1.5 text-sm text-muted hover:text-foreground-dim"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                {unbanReasonId === u.id &&
                  (u.is_banned || u.is_shadowbanned) && (
                  <div className="mt-3 pt-3 border-t border-line space-y-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">
                        Reason for unban (required)
                      </label>
                      <textarea
                        value={unbanReason}
                        onChange={(e) => setUnbanReason(e.target.value)}
                        placeholder="Reason for lifting this ban..."
                        rows={2}
                        className="w-full px-3 py-2 text-sm bg-surface-sunken border border-line rounded-lg focus:border-line-focus focus:outline-none resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUnban(u.id)}
                        disabled={actioning === u.id}
                        className="px-4 py-1.5 text-sm bg-green-900/50 border border-green-900 text-green-400 rounded-lg hover:bg-green-900/70 disabled:opacity-30"
                      >
                        {actioning === u.id ? "Unbanning..." : "Confirm unban"}
                      </button>
                      <button
                        onClick={() => {
                          setUnbanReasonId(null);
                          setUnbanReason("");
                        }}
                        className="px-4 py-1.5 text-sm text-muted hover:text-foreground-dim"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {historyId === u.id && (
                  <div className="mt-3 pt-3 border-t border-line">
                    {historyLoading ? (
                      <p className="text-xs text-muted">Loading history...</p>
                    ) : history.length === 0 ? (
                      <p className="text-xs text-muted-faint">
                        No ban history.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {history.map((b) => (
                          <div
                            key={b.id}
                            className="text-xs bg-surface-sunken rounded-lg p-2"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`px-1.5 py-0.5 rounded ${
                                  b.active
                                    ? b.type === "shadow"
                                      ? "bg-purple-900/50 text-purple-400"
                                      : "bg-red-900/50 text-red-400"
                                    : "bg-surface-raised text-muted"
                                }`}
                              >
                                {b.active
                                  ? b.type === "shadow"
                                    ? "Shadow (active)"
                                    : "Active"
                                  : "Lifted"}
                              </span>
                              {b.type && b.type !== "shadow" && (
                                <span className="px-1.5 py-0.5 rounded bg-surface-raised text-muted">
                                  {b.type === "permanent"
                                    ? "Permanent"
                                    : "Temporary"}
                                </span>
                              )}
                              {b.appeal_state && b.appeal_state !== "none" && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400">
                                  Appeal: {b.appeal_state}
                                </span>
                              )}
                              <span className="text-muted-faint">
                                {new Date(b.banned_at).toLocaleString()}
                                {b.expires_at &&
                                  ` → ${new Date(b.expires_at).toLocaleString()}`}
                              </span>
                            </div>
                            <p className="text-foreground-dim">{b.reason}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
