"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteNav, Spinner, Badge, ProgressBar } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  getMyProfile,
  updateMyUsername,
  signOut,
  setNsfwOptIn,
  deleteMyAccount,
} from "@/lib/actions/profile";
import { DELETE_CONFIRMATION } from "@/lib/config/constants";
import {
  createVIPOrder,
  createTokenPackageOrder,
} from "@/lib/actions/billing";
import { TOKEN_PACKAGES } from "@/lib/billing/constants";
import { listMyBlocks, unblockUser } from "@/lib/actions/blocks";

type BlockedUser = {
  blocked_id: string;
  anonymous_username: string;
  anonymous_pfp_url: string | null;
  created_at: string;
};

type ProfileData = {
  id: string;
  anonymous_username: string;
  anonymous_pfp_url: string | null;
  reputation_score: number;
  /* get_own_profile has always returned these; the page just dropped
     them at the type level, so recompute_tier's whole output — tier and
     earned tags, recalculated on every rating — was invisible to the
     user it described. */
  reputation_tier: string;
  earned_tags: string[];
  tokens_balance: number;
  is_vip: boolean;
  vip_expires_at: string | null;
  age_cohort: string | null;
  nsfw_opt_in: boolean;
  created_at: string;
};

/* Thresholds mirror recompute_tier in schema.sql. Kept in sync by hand;
   the server is authoritative for the tier itself, this is only used to
   draw the progress bar toward the next one. */
const TIER_LADDER: Array<{ tier: string; min: number; label: string }> = [
  { tier: "new", min: 0, label: "New" },
  { tier: "regular", min: 5, label: "Regular" },
  { tier: "trusted", min: 15, label: "Trusted" },
  { tier: "legendary", min: 30, label: "Legendary" },
];

function nextTier(score: number) {
  return TIER_LADDER.find((t) => score < t.min) ?? null;
}

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
  const [purchasing, setPurchasing] = useState<string | null>(null);

  /* Blocked users. This is the only place a block can be undone — the
     block controls in a scene are one-way by design, since the scene is
     anonymous and you may not remember who you blocked. */
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

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
          reputation_tier: p.reputation_tier,
          earned_tags: p.earned_tags ?? [],
          tokens_balance: p.tokens_balance,
          is_vip: p.is_vip,
          vip_expires_at: p.vip_expires_at ?? null,
          age_cohort: p.age_cohort ?? null,
          nsfw_opt_in: p.nsfw_opt_in ?? false,
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

  /* ── blocked users ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await listMyBlocks();
      if (cancelled) return;
      if (!("error" in result)) setBlocks(result.blocks);
      setBlocksLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUnblock(profileId: string) {
    if (unblocking) return;
    setUnblocking(profileId);
    const result = await unblockUser(profileId);
    setUnblocking(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setBlocks((prev) => prev.filter((b) => b.blocked_id !== profileId));
  }

  async function handleDeleteAccount() {
    if (deleting || deleteConfirm !== DELETE_CONFIRMATION) return;
    setDeleting(true);
    const result = await deleteMyAccount(deleteConfirm);
    if ("error" in result) {
      setDeleting(false);
      setError(result.error);
      return;
    }
    /* Hard navigation, not router.push — the session is gone and every
       cached RSC payload on this route belongs to a user that no longer
       exists. */
    window.location.href = "/";
  }

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

  /* ── buy VIP: redirect to NOWPayments checkout ── */
  async function handleBuyVIP() {
    setPurchasing("vip");
    setError("");
    const result = await createVIPOrder();
    setPurchasing(null);
    if ("error" in result) {
      setError(result.error);
    } else {
      window.location.assign(result.invoiceUrl);
    }
  }

  /* ── buy token package: redirect to NOWPayments checkout ── */
  async function handleBuyTokens(packageId: string) {
    setPurchasing(packageId);
    setError("");
    const result = await createTokenPackageOrder(packageId);
    setPurchasing(null);
    if ("error" in result) {
      setError(result.error);
    } else {
      window.location.assign(result.invoiceUrl);
    }
  }

  /* ── toggle NSFW opt-in ── */
  const [nsfwLoading, setNsfwLoading] = useState(false);

  async function handleToggleNsfw() {
    if (!profile) return;
    const next = !profile.nsfw_opt_in;
    setNsfwLoading(true);
    setError("");
    const result = await setNsfwOptIn(next);
    setNsfwLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      setProfile((prev) => (prev ? { ...prev, nsfw_opt_in: next } : prev));
      setSuccessMsg(next ? "NSFW content enabled." : "NSFW content disabled.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-void-950 flex flex-col items-center justify-center gap-4">
        <Spinner />
        <p className="text-muted text-sm">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-void-950 flex items-center justify-center">
        <p className="text-muted text-sm">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void-950 text-white">
      {/* background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,45,149,0.08)_0%,transparent_50%)]" />

      {/* ── NAV BAR ── */}
      <SiteNav />

      {/* ── PAGE HEADER ── */}
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-8">
        <h1 className="text-3xl font-light text-foreground tracking-wide">
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
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand to-crimson-500 flex items-center justify-center shrink-0">
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
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-lg w-64 placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveUsername}
                      disabled={saving}
                      className="  bg-gradient-to-r from-brand-dark to-crimson-600 text-white text-sm px-4 py-2 rounded-lg hover:from-brand hover:to-crimson-500 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="bg-white/5 border border-white/10 text-muted-strong text-sm px-4 py-2 rounded-lg hover:bg-white/10 transition-all"
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
                      className="text-muted hover:text-brand-light text-sm transition-colors"
                    >
                      &#9998;
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Joined {formatDate(profile.created_at, "month")}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* stats */}
          <div className="flex flex-wrap gap-8 mt-6 pt-6 border-t border-white/5">
            <div>
              <p className="text-xs text-muted uppercase tracking-wider">
                Reputation
              </p>
              <p className="text-xl text-white font-medium mt-1">
                &#9733; {profile.reputation_score}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wider">
                Tokens
              </p>
              <p className="text-xl text-brand-light font-medium mt-1">
                &#9670; {profile.tokens_balance.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wider">
                VIP
              </p>
              <p
                className={[
                  "text-xl font-medium mt-1",
                  profile.is_vip
                    ? "text-yellow-400"
                    : "text-muted",
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
              <p className="text-sm text-muted mt-1">
                Unlimited matches &bull; Deep Dive &bull; AI Images
                &bull; Priority Queue
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-strong">$9.99 / 30 days</span>
              <button
                type="button"
                onClick={handleBuyVIP}
                disabled={purchasing !== null}
                className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-medium text-sm px-6 py-2.5 rounded-xl hover:from-yellow-400 hover:to-amber-400 active:scale-95 transition-all disabled:opacity-50"
              >
                {purchasing === "vip" ? "Loading..." : "Become VIP \u2192"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── VIP ACTIVE BANNER ── */}
      {profile.is_vip && profile.vip_expires_at && (
        <section className="max-w-3xl mx-auto px-6 mb-8">
          <div className="bg-gradient-to-br from-yellow-900/10 to-amber-900/10 border border-yellow-500/20 rounded-2xl p-6 text-center">
            <p className="text-lg font-medium text-yellow-400">
              VIP Active
            </p>
            <p className="text-sm text-muted mt-1">
              Expires {formatDate(profile.vip_expires_at)}
            </p>
          </div>
        </section>
      )}

      {/* ── TOKEN STORE ── */}
      <section className="max-w-3xl mx-auto px-6 mb-8">
        <h2 className="text-xl font-light text-foreground-dim mb-4">
          Buy Tokens
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TOKEN_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-3"
            >
              <p className="text-2xl font-light text-brand-light">
                &#9670; {pkg.tokens.toLocaleString()}
              </p>
              <p className="text-lg font-medium text-white">
                ${pkg.priceUsd.toFixed(2)}
              </p>
              <button
                type="button"
                onClick={() => handleBuyTokens(pkg.id)}
                disabled={purchasing !== null}
                className="w-full bg-gradient-to-r from-brand-dark to-crimson-600 text-white font-medium text-sm py-2.5 rounded-xl hover:from-brand hover:to-crimson-500 active:scale-95 transition-all disabled:opacity-50"
              >
                {purchasing === pkg.id ? "Loading..." : "Buy"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── MATCH HISTORY ── */}
      <section className="max-w-3xl mx-auto px-6 mb-8">
        <h2 className="text-xl font-light text-foreground-dim mb-4">
          Match History
        </h2>

        {matches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-faint italic">
              No matches yet. Find your first match in the lobby.
            </p>
            <Link
              href="/lobby"
              className="text-brand-light text-sm hover:text-brand-lighter transition-colors mt-2 inline-block"
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
                          : "border-brand/30 text-brand-light",
                      ].join(" ")}
                    >
                      {m.tier === "deep" ? "Deep" : "Quick"}
                    </span>
                    <span className="text-sm text-foreground-dim">
                      {m.is_ai_match
                        ? "\uD83E\uDD16 AI Match"
                        : "\uD83D\uDC65 Human Match"}
                    </span>
                  </div>
                  {(m.scenario_tags ?? []).length > 0 && (
                    <p className="text-xs text-muted mt-1 truncate">
                      {(m.scenario_tags ?? [])
                        .map((t: string) =>
                          t.replace(/_/g, " ")
                        )
                        .join(" \u2022 ")}
                    </p>
                  )}
                </div>

                {/* center */}
                <span className="text-xs text-muted shrink-0">
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
                          ? "bg-brand/10 text-brand-light border-brand/20"
                          : "bg-white/5 text-muted border-white/10",
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
                      className="text-xs text-brand-light hover:text-brand-lighter transition-colors"
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

      {/* ── NSFW OPT-IN ── */}
      <section className="max-w-3xl mx-auto px-6 mb-8">
        <h2 className="text-xl font-light text-foreground-dim mb-4">
          Content Preferences
        </h2>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground-dim">
                NSFW Content
              </p>
              <p className="text-xs text-muted mt-1 max-w-sm">
                Enable access to adult (18+) characters and scenarios.
                Requires age verification. You can disable this at any time.
              </p>
            </div>
            {profile.age_cohort === "adult" ? (
              <button
                type="button"
                onClick={handleToggleNsfw}
                disabled={nsfwLoading}
                className={[
                  "relative shrink-0 w-12 h-6 rounded-full transition-colors",
                  profile.nsfw_opt_in ? "bg-brand-dark" : "bg-white/10",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                    profile.nsfw_opt_in ? "translate-x-6" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
            ) : (
              <span className="text-xs text-muted-faint shrink-0">
                18+ required
              </span>
            )}
          </div>
          {profile.nsfw_opt_in && (
            <p className="text-xs text-brand-light mt-3">
              NSFW content is currently enabled.
            </p>
          )}
        </div>
      </section>

      {/* ── REPUTATION ── */}
      {profile && (
        <section className="max-w-3xl mx-auto px-6 mb-8">
          <h2 className="text-xl font-light text-foreground-dim mb-4">
            Reputation
          </h2>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Badge tone="tier">
                  {TIER_LADDER.find((t) => t.tier === profile.reputation_tier)
                    ?.label ?? profile.reputation_tier}
                </Badge>
                <span className="text-sm text-muted">
                  {profile.reputation_score} point
                  {profile.reputation_score === 1 ? "" : "s"}
                </span>
              </div>
              {nextTier(profile.reputation_score) && (
                <span className="text-xs text-muted">
                  {nextTier(profile.reputation_score)!.min -
                    profile.reputation_score}{" "}
                  more to {nextTier(profile.reputation_score)!.label}
                </span>
              )}
            </div>

            {nextTier(profile.reputation_score) && (
              <div className="mt-4">
                <ProgressBar
                  value={profile.reputation_score}
                  max={nextTier(profile.reputation_score)!.min}
                />
              </div>
            )}

            <p className="mt-4 text-sm text-muted">
              Points come from the vibe check people leave after a scene
              with you. Tags below are the three words chosen most often
              to describe you — they refresh every five ratings.
            </p>

            {profile.earned_tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.earned_tags.map((tag) => (
                  <Badge key={tag} tone="personality">
                    {tag.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-faint">
                No earned tags yet — they appear after your fifth rating.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── BLOCKED USERS ── */}
      <section className="max-w-3xl mx-auto px-6 mb-8">
        <h2 className="text-xl font-light text-foreground-dim mb-4">
          Blocked Users
        </h2>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          {blocksLoading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : blocks.length === 0 ? (
            <p className="text-sm text-muted">
              You haven&apos;t blocked anyone. You can block someone from
              inside a scene — they are never told.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted mb-4">
                You will never be matched with these users again. Names are
                the anonymous handles they used when you blocked them.
              </p>
              <ul className="space-y-2">
                {blocks.map((b) => (
                  <li
                    key={b.blocked_id}
                    className="flex items-center justify-between gap-4 bg-white/5 border border-white/5 rounded-xl px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">
                        {b.anonymous_username}
                      </p>
                      <p className="text-xs text-muted">
                        Blocked{" "}
                        {new Date(b.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblock(b.blocked_id)}
                      disabled={unblocking === b.blocked_id}
                      className="shrink-0 text-xs bg-white/5 border border-white/10 text-muted-strong px-3 py-1.5 rounded-lg hover:bg-white/10 hover:text-foreground-dim disabled:opacity-50 transition-all"
                    >
                      {unblocking === b.blocked_id ? "…" : "Unblock"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* ── DANGER ZONE ── */}
      <section className="max-w-3xl mx-auto px-6 mb-24">
        <h2 className="text-xl font-light text-foreground-dim mb-4">
          Account
        </h2>

        <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6">
          <button
            type="button"
            onClick={handleSignOut}
            className="bg-white/5 border border-white/10 text-muted-strong font-medium px-6 py-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
          >
            Sign Out
          </button>
          <p className="text-xs text-muted-faint mt-2">
            You&apos;ll be redirected to the homepage.
          </p>

          {/* ── DELETE ACCOUNT ──
              Promised in the privacy policy since day one with nothing
              behind it. Irreversible, so it is deliberately awkward:
              two steps and an exact phrase. */}
          <div className="mt-8 pt-6 border-t border-red-500/10">
            {!showDelete ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowDelete(true)}
                  className="text-sm text-danger hover:text-red-300 transition-colors"
                >
                  Delete my account
                </button>
                <p className="text-xs text-muted-faint mt-2">
                  Permanent. Removes your profile, characters, solo
                  sessions, and notifications.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-danger font-medium mb-2">
                  This cannot be undone.
                </p>
                <ul className="text-xs text-muted space-y-1 list-disc list-inside mb-4">
                  <li>
                    Your profile, characters, solo sessions, ratings,
                    blocks, and notifications are deleted.
                  </li>
                  <li>
                    Messages you sent stay in your partners&apos; chat
                    history, detached from your name.
                  </li>
                  <li>
                    Payment records are kept de-identified for 7 years for
                    tax and legal compliance.
                  </li>
                  <li>Any remaining tokens and VIP time are forfeited.</li>
                </ul>

                <label
                  htmlFor="delete-confirm"
                  className="block text-xs text-muted-strong mb-2"
                >
                  Type{" "}
                  <span className="font-mono text-danger">
                    {DELETE_CONFIRMATION}
                  </span>{" "}
                  to confirm.
                </label>
                <input
                  id="delete-confirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  autoComplete="off"
                  className="w-full max-w-sm bg-white/5 border border-red-500/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-muted-faint focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all"
                  placeholder={DELETE_CONFIRMATION}
                />

                <div className="flex items-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={
                      deleting || deleteConfirm !== DELETE_CONFIRMATION
                    }
                    className="bg-red-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {deleting ? "Deleting…" : "Delete permanently"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDelete(false);
                      setDeleteConfirm("");
                    }}
                    className="text-sm text-muted hover:text-foreground-dim transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
