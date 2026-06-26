"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getMyProfile, updateMyUsername, signOut } from "@/lib/actions/profile";

type ProfileData = {
  id: string;
  anonymous_username: string;
  anonymous_pfp_url: string | null;
  reputation_score: number;
  tokens_balance: number;
  is_vip: boolean;
  created_at: string;
};

type MatchHistoryItem = {
  id: string;
  status: "active" | "ended" | "revealed";
  tier: "quick" | "deep";
  is_ai_match: boolean;
  scenario_tags: string[];
  user_a: string;
  user_b: string | null;
  created_at: string;
  ended_at: string | null;
};

/**
 * Formats an ISO date string to a short display format.
 */
function formatDate(iso: string, style: "short" | "month" = "short"): string {
  const d = new Date(iso);
  if (style === "month") {
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/**
 * User profile page. View and edit anonymous username, see match
 * history, manage VIP status, and sign out.
 */
export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  /* ── auto-dismiss error ── */
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  /* ── auto-dismiss success ── */
  useEffect(() => {
    if (!successMsg) return;
    const timer = setTimeout(() => setSuccessMsg(""), 3000);
    return () => clearTimeout(timer);
  }, [successMsg]);

  /* ── fetch data ── */
  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      /* B1: read profile via getMyProfile action — tokens_balance/is_vip
         are REVOKED from authenticated direct SELECT. */
      const profileResult = await getMyProfile();
      if ("profile" in profileResult) {
        const p = profileResult.profile;
        setProfile({
          id: p.id,
          anonymous_username: p.anonymous_username,
          anonymous_pfp_url: p.anonymous_pfp_url,
          reputation_score: p.reputation_score,
          tokens_balance: p.tokens_balance,
          is_vip: p.is_vip,
          created_at: p.created_at,
        });
        setNewUsername(p.anonymous_username);
      }

      const { data: matchData } = await supabase
        .from("matches")
        .select("*")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(20);

      setMatches((matchData as MatchHistoryItem[]) ?? []);

      setLoading(false);
    }

    load();
  }, [router]);

  /* ── save username ── */
  async function handleSaveUsername() {
    if (!profile) return;
    const trimmed = newUsername.trim();

    if (trimmed.length < 2 || trimmed.length > 20) {
      setError("Username must be 2–20 characters");
      return;
    }

    setSaving(true);
    setError("");

    /* Use the updateMyUsername server action — wraps the
       update_profile_username RPC (column-restricted). */
    const result = await updateMyUsername(trimmed);

    if ("error" in result) {
      setError(result.error);
    } else {
      setProfile((prev) =>
        prev ? { ...prev, anonymous_username: trimmed } : prev
      );
      setEditing(false);
      setSuccessMsg("Username updated!");
    }

    setSaving(false);
  }

  /* ── cancel edit ── */
  function handleCancelEdit() {
    setEditing(false);
    if (profile) setNewUsername(profile.anonymous_username);
    setError("");
  }

  /* ── sign out (S5: server action clears session cookies) ── */
  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  /* ── buy VIP (mock) ── */
  function handleBuyVIP() {
    setSuccessMsg("VIP checkout coming soon!");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
        <p className="text-gray-500 text-sm">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-500 text-sm">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(88,28,135,0.08)_0%,transparent_50%)]" />

      {/* ── NAV BAR ── */}
      <nav className="sticky top-0 z-10 border-b border-white/5 backdrop-blur-md bg-black/40 px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-xl font-bold text-purple-400 hover:text-purple-300 transition-colors"
        >
          chatty
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/lobby"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Lobby
          </Link>
          <Link
            href="/characters"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Characters
          </Link>
          <Link
            href="/create-character"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Create
          </Link>
        </div>
      </nav>

      {/* ── PAGE HEADER ── */}
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-8">
        <h1 className="text-3xl font-light text-gray-200 tracking-wide">
          Your Profile
        </h1>
      </div>

      {/* ── MESSAGES ── */}
      <div className="max-w-3xl mx-auto px-6 pb-4 space-y-3">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-xl text-center">
            {successMsg}
          </div>
        )}
      </div>

      {/* ── PROFILE CARD ── */}
      <section className="max-w-3xl mx-auto px-6 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          {/* top row */}
          <div className="flex items-start gap-6">
            {/* avatar */}
            {profile.anonymous_pfp_url ? (
              <div
                className="w-24 h-24 rounded-full bg-cover bg-center shrink-0"
                style={{
                  backgroundImage: `url(${profile.anonymous_pfp_url})`,
                }}
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                <span className="text-3xl text-white font-bold">
                  {profile.anonymous_username
                    .charAt(0)
                    .toUpperCase()}
                </span>
              </div>
            )}

            {/* username */}
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    maxLength={20}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-lg w-64 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveUsername}
                      disabled={saving}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm px-4 py-2 rounded-lg hover:from-purple-500 hover:to-pink-500 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="bg-white/5 border border-white/10 text-gray-400 text-sm px-4 py-2 rounded-lg hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-medium text-white">
                      {profile.anonymous_username}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="text-gray-500 hover:text-purple-400 text-sm transition-colors"
                    >
                      &#9998;
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Joined {formatDate(profile.created_at, "month")}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* stats */}
          <div className="flex flex-wrap gap-8 mt-6 pt-6 border-t border-white/5">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                Reputation
              </p>
              <p className="text-xl text-white font-medium mt-1">
                &#9733; {profile.reputation_score}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                Tokens
              </p>
              <p className="text-xl text-purple-400 font-medium mt-1">
                &#9670; {profile.tokens_balance.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                VIP
              </p>
              <p
                className={[
                  "text-xl font-medium mt-1",
                  profile.is_vip
                    ? "text-yellow-400"
                    : "text-gray-500",
                ].join(" ")}
              >
                {profile.is_vip ? "\u2713 Active" : "\u2717 Free"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── VIP UPSELL ── */}
      {!profile.is_vip && (
        <section className="max-w-3xl mx-auto px-6 mb-8">
          <div className="bg-gradient-to-br from-yellow-900/10 to-amber-900/10 border border-yellow-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-lg font-medium text-yellow-400">
                Upgrade to VIP
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Unlimited matches &bull; Deep Dive &bull; AI Images
                &bull; Priority Queue
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">$9.99/mo</span>
              <button
                type="button"
                onClick={handleBuyVIP}
                className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-medium text-sm px-6 py-2.5 rounded-xl hover:from-yellow-400 hover:to-amber-400 active:scale-95 transition-all"
              >
                Become VIP &rarr;
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── MATCH HISTORY ── */}
      <section className="max-w-3xl mx-auto px-6 mb-8">
        <h2 className="text-xl font-light text-gray-300 mb-4">
          Match History
        </h2>

        {matches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-600 italic">
              No matches yet. Find your first match in the lobby.
            </p>
            <Link
              href="/lobby"
              className="text-purple-400 text-sm hover:text-purple-300 transition-colors mt-2 inline-block"
            >
              &rarr; Go to Lobby
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {matches.map((m) => (
              <div
                key={m.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                {/* left */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        "text-xs px-2 py-0.5 rounded-full border",
                        m.tier === "deep"
                          ? "border-pink-500/30 text-pink-400"
                          : "border-purple-500/30 text-purple-400",
                      ].join(" ")}
                    >
                      {m.tier === "deep" ? "Deep" : "Quick"}
                    </span>
                    <span className="text-sm text-gray-300">
                      {m.is_ai_match
                        ? "\uD83E\uDD16 AI Match"
                        : "\uD83D\uDC65 Human Match"}
                    </span>
                  </div>
                  {(m.scenario_tags ?? []).length > 0 && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {(m.scenario_tags ?? [])
                        .map((t: string) =>
                          t.replace(/_/g, " ")
                        )
                        .join(" \u2022 ")}
                    </p>
                  )}
                </div>

                {/* center */}
                <span className="text-xs text-gray-500 shrink-0">
                  {formatDate(m.created_at)}
                </span>

                {/* right */}
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={[
                      "text-xs px-2 py-0.5 rounded-full border font-medium",
                      m.status === "active"
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : m.status === "revealed"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          : "bg-white/5 text-gray-500 border-white/10",
                    ].join(" ")}
                  >
                    {m.status === "active"
                      ? "Active"
                      : m.status === "revealed"
                        ? "Revealed"
                        : "Ended"}
                  </span>
                  {m.status === "revealed" && (
                    <Link
                      href={`/dm/${m.id}`}
                      className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      &rarr; DM
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── DANGER ZONE ── */}
      <section className="max-w-3xl mx-auto px-6 mb-24">
        <h2 className="text-xl font-light text-gray-300 mb-4">
          Account
        </h2>

        <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6">
          <button
            type="button"
            onClick={handleSignOut}
            className="bg-white/5 border border-white/10 text-gray-400 font-medium px-6 py-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
          >
            Sign Out
          </button>
          <p className="text-xs text-gray-600 mt-2">
            You&apos;ll be redirected to the homepage.
          </p>
        </div>
      </section>
    </div>
  );
}
