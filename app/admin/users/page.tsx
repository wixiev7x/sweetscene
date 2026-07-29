"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isAdmin,
  listUsers,
  banUser,
  unbanUser,
  grantTokens,
  expireBans,
} from "@/lib/actions/admin";

type User = {
  id: string;
  anonymous_username: string;
  anonymous_pfp_url: string | null;
  reputation_score: number;
  tokens_balance: number;
  is_vip: boolean;
  is_admin: boolean;
  is_banned: boolean;
  banned_until: string | null;
  created_at: string;
};

/**
 * Temporary restriction durations. banned_until is a timestamp, and
 * is_current_user_banned() treats a past timestamp as unbanned, so a
 * restriction lifts itself without any sweep running.
 */
const RESTRICT_DURATIONS: Array<{ label: string; hours: number }> = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: 24 * 30 },
];

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);
  /** User id whose duration picker is open, if any. */
  const [restrictingId, setRestrictingId] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);

  useEffect(() => {
    (async () => {
      const admin = await isAdmin();
      if (!admin) {
        router.replace("/lobby");
        return;
      }
      setAuthorized(true);
      await loadUsers("");
      setLoading(false);
    })();
  }, [router]);

  async function loadUsers(s: string) {
    const result = await listUsers(s, 50, 0);
    if (!("error" in result)) {
      setUsers(result.users);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadUsers(search);
  }

  async function handleBan(userId: string) {
    if (
      !confirm(
        "Permanently ban this user? They will be blocked from matchmaking and chat until manually unbanned."
      )
    )
      return;
    setActioning(userId);
    const result = await banUser(userId, null);
    setActioning(null);
    if ("error" in result) alert(result.error);
    setRestrictingId(null);
    await loadUsers(search);
  }

  /** Temporary restriction — same ban flag, with an expiry timestamp. */
  async function handleRestrict(userId: string, hours: number) {
    const until = new Date(Date.now() + hours * 3_600_000).toISOString();
    setActioning(userId);
    const result = await banUser(userId, until);
    setActioning(null);
    if ("error" in result) alert(result.error);
    setRestrictingId(null);
    await loadUsers(search);
  }

  async function handleUnban(userId: string) {
    setActioning(userId);
    const result = await unbanUser(userId);
    setActioning(null);
    if ("error" in result) alert(result.error);
    await loadUsers(search);
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
    const input = prompt("Token amount (positive to grant, negative to deduct):");
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

  if (!authorized || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <Link href="/admin" className="text-muted hover:text-foreground-dim">
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

        <form onSubmit={handleSearch} className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username..."
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
                      {u.is_admin && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-brand-deep/50 text-brand-light border border-brand-deep">
                          Admin
                        </span>
                      )}
                      {u.is_vip && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-amber-900/50 text-amber-400 border border-amber-900">
                          VIP
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
                      {u.tokens_balance.toLocaleString()} tokens &middot;{" "}
                      Rep: {u.reputation_score} &middot;{" "}
                      {new Date(u.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleGrantTokens(u.id)}
                    disabled={actioning === u.id || u.is_admin}
                    aria-label="Adjust tokens"
                    className="px-3 py-1.5 text-sm bg-blue-900/30 border border-blue-900 text-blue-400 rounded-lg hover:bg-blue-900/50 disabled:opacity-30"
                  >
                    Tokens
                  </button>
                  {u.is_banned ? (
                    <button
                      onClick={() => handleUnban(u.id)}
                      disabled={actioning === u.id || u.is_admin}
                      aria-label="Unban user"
                      className="px-3 py-1.5 text-sm bg-green-900/30 border border-green-900 text-green-400 rounded-lg hover:bg-green-900/50 disabled:opacity-30"
                    >
                      Unban
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          setRestrictingId(
                            restrictingId === u.id ? null : u.id
                          )
                        }
                        disabled={actioning === u.id || u.is_admin}
                        aria-label="Temporarily restrict user"
                        aria-expanded={restrictingId === u.id}
                        className="px-3 py-1.5 text-sm bg-orange-900/30 border border-orange-900 text-orange-400 rounded-lg hover:bg-orange-900/50 disabled:opacity-30"
                      >
                        Restrict
                      </button>
                      <button
                        onClick={() => handleBan(u.id)}
                        disabled={actioning === u.id || u.is_admin}
                        aria-label="Ban user permanently"
                        className="px-3 py-1.5 text-sm bg-red-900/30 border border-red-900 text-red-400 rounded-lg hover:bg-red-900/50 disabled:opacity-30"
                      >
                        Ban
                      </button>
                    </>
                  )}
                </div>
                </div>

                {restrictingId === u.id && !u.is_banned && (
                  <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted mr-1">
                      Restrict for:
                    </span>
                    {RESTRICT_DURATIONS.map((d) => (
                      <button
                        key={d.hours}
                        onClick={() => handleRestrict(u.id, d.hours)}
                        disabled={actioning === u.id}
                        className="px-3 py-1 text-xs bg-surface-raised border border-line-strong rounded-lg hover:border-orange-900 hover:text-orange-400 disabled:opacity-30"
                      >
                        {d.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setRestrictingId(null)}
                      className="px-3 py-1 text-xs text-muted hover:text-foreground-dim"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}