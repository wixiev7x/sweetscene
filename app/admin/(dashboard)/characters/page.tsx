"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  listCharacters,
  setCharacterFlag,
  deleteCharacter,
  listPendingCharacters,
  adminReviewCharacter,
  type PendingCharacterRow,
} from "@/lib/actions/admin";

type Character = {
  id: string;
  name: string;
  creator_id: string | null;
  visibility: string;
  is_nsfw: boolean;
  is_featured: boolean;
  is_hidden: boolean;
  chat_count: number;
  created_at: string;
  creator_username: string | null;
};

export default function AdminCharactersPage() {
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [search, setSearch] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);

  /* Phase 5 — avatar review queue. */
  const [pending, setPending] = useState<PendingCharacterRow[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      await Promise.all([loadCharacters(""), loadPending()]);
      setLoading(false);
    })();
  }, []);

  async function loadCharacters(s: string) {
    const result = await listCharacters(s, 50, 0);
    if (!("error" in result)) {
      setCharacters(result.characters);
    }
  }

  async function loadPending() {
    setPendingLoading(true);
    const result = await listPendingCharacters(50, 0);
    if (!("error" in result)) {
      setPending(result.characters);
    }
    setPendingLoading(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadCharacters(search);
  }

  async function handleFlag(
    charId: string,
    flag: "is_featured" | "is_hidden",
    value: boolean
  ) {
    setActioning(charId);
    await setCharacterFlag(charId, flag, value);
    setActioning(null);
    await loadCharacters(search);
  }

  async function handleDelete(charId: string, name: string) {
    if (!confirm(`Delete character "${name}"? This cannot be undone.`)) return;
    setActioning(charId);
    await deleteCharacter(charId);
    setActioning(null);
    await loadCharacters(search);
  }

  /* Phase 5 — approve/reject a pending character. Both actions are
     logged in admin_audit_log and notify the creator. */
  async function handleReview(
    charId: string,
    decision: "approved" | "rejected"
  ) {
    setReviewingId(charId);
    const result = await adminReviewCharacter(charId, decision, notes[charId] ?? "");
    setReviewingId(null);
    if ("error" in result) {
      alert(result.error);
      return;
    }
    await Promise.all([loadPending(), loadCharacters(search)]);
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
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-muted hover:text-foreground-dim">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Character Management</h1>
        </div>

        {/* ── PHASE 5: AVATAR REVIEW QUEUE ── */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-semibold">Review Queue</h2>
            {!pendingLoading && pending.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-900/50 text-cyan-400 border border-cyan-900">
                {pending.length} pending
              </span>
            )}
          </div>

          {pendingLoading ? (
            <p className="text-muted text-sm">Loading queue…</p>
          ) : pending.length === 0 ? (
            <p className="text-muted text-sm">
              Nothing waiting for review. Characters with uploaded avatars
              appear here before going public.
            </p>
          ) : (
            <div className="space-y-3">
              {pending.map((p) => (
                <div
                  key={p.id}
                  className="bg-surface border border-cyan-900/50 rounded-lg p-4"
                >
                  <div className="flex items-start gap-4">
                    {p.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.avatar_url}
                        alt={p.name}
                        className="w-16 h-16 rounded-lg object-cover shrink-0 border border-line"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-surface-raised border border-line flex items-center justify-center text-muted text-xs shrink-0">
                        no img
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        {p.is_nsfw && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-pink-900/50 text-pink-400 border border-pink-900">
                            NSFW
                          </span>
                        )}
                        {p.category && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-surface-raised text-muted-strong border border-line-strong">
                            {p.category}
                          </span>
                        )}
                      </div>
                      {p.tagline && (
                        <p className="text-xs text-muted mt-0.5 italic truncate">
                          {p.tagline}
                        </p>
                      )}
                      <p className="text-xs text-muted-faint mt-1">
                        By {p.creator_username ?? "unknown"} · waiting since{" "}
                        {new Date(p.updated_at).toLocaleString()}
                      </p>
                      {(p.triggers?.length > 0 || p.limits?.length > 0) && (
                        <div className="mt-2 flex flex-col gap-1">
                          {p.triggers?.length > 0 && (
                            <p className="text-[11px] text-muted-faint">
                              <span className="text-muted-strong font-medium">
                                Triggers:
                              </span>{" "}
                              {p.triggers.join(", ")}
                            </p>
                          )}
                          {p.limits?.length > 0 && (
                            <p className="text-[11px] text-muted-faint">
                              <span className="text-muted-strong font-medium">
                                Limits:
                              </span>{" "}
                              {p.limits.join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                      <input
                        type="text"
                        value={notes[p.id] ?? ""}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        maxLength={500}
                        placeholder="Optional note to the creator (sent with the decision)…"
                        aria-label={`Review note for ${p.name}`}
                        className="w-full mt-2 px-3 py-1.5 text-xs bg-surface-raised border border-line-strong rounded-lg focus:border-line-focus focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleReview(p.id, "approved")}
                        disabled={reviewingId === p.id}
                        aria-label={`Approve ${p.name}`}
                        className="px-4 py-1.5 text-sm bg-green-900/30 border border-green-900 text-green-400 rounded-lg hover:bg-green-900/50 disabled:opacity-30"
                      >
                        {reviewingId === p.id ? "…" : "Approve"}
                      </button>
                      <button
                        onClick={() => handleReview(p.id, "rejected")}
                        disabled={reviewingId === p.id}
                        aria-label={`Reject ${p.name}`}
                        className="px-4 py-1.5 text-sm bg-red-900/30 border border-red-900 text-red-400 rounded-lg hover:bg-red-900/50 disabled:opacity-30"
                      >
                        {reviewingId === p.id ? "…" : "Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── ALL CHARACTERS ── */}
        <h2 className="text-lg font-semibold mb-3">All Characters</h2>
        <form onSubmit={handleSearch} className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            aria-label="Search characters"
            className="w-full px-4 py-2 bg-surface border border-line rounded-lg focus:border-line-focus focus:outline-none"
          />
        </form>

        {characters.length === 0 ? (
          <p className="text-muted">No characters found.</p>
        ) : (
          <div className="space-y-2">
            {characters.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between bg-surface border border-line rounded-lg p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {c.is_nsfw && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-pink-900/50 text-pink-400 border border-pink-900">
                        NSFW
                      </span>
                    )}
                    {c.is_featured && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-amber-900/50 text-amber-400 border border-amber-900">
                        Featured
                      </span>
                    )}
                    {c.is_hidden && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-red-900/50 text-red-400 border border-red-900">
                        Hidden
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-xs bg-surface-raised text-muted-strong border border-line-strong">
                      {c.visibility}
                    </span>
                  </div>
                  <p className="text-xs text-muted-faint mt-1">
                    By {c.creator_username ?? "deleted"} &middot;{" "}
                    {c.chat_count} chats &middot;{" "}
                    {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  {c.is_featured ? (
                    <button
                      onClick={() => handleFlag(c.id, "is_featured", false)}
                      disabled={actioning === c.id}
                      aria-label="Unfeature character"
                      className="px-3 py-1.5 text-sm bg-amber-900/30 border border-amber-900 text-amber-400 rounded-lg hover:bg-amber-900/50 disabled:opacity-30"
                    >
                      Unfeature
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFlag(c.id, "is_featured", true)}
                      disabled={actioning === c.id}
                      aria-label="Feature character"
                      className="px-3 py-1.5 text-sm bg-surface-raised border border-line-strong text-muted-strong rounded-lg hover:bg-line-strong disabled:opacity-30"
                    >
                      Feature
                    </button>
                  )}
                  {c.is_hidden ? (
                    <button
                      onClick={() => handleFlag(c.id, "is_hidden", false)}
                      disabled={actioning === c.id}
                      aria-label="Unhide character"
                      className="px-3 py-1.5 text-sm bg-green-900/30 border border-green-900 text-green-400 rounded-lg hover:bg-green-900/50 disabled:opacity-30"
                    >
                      Unhide
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFlag(c.id, "is_hidden", true)}
                      disabled={actioning === c.id}
                      aria-label="Hide character"
                      className="px-3 py-1.5 text-sm bg-orange-900/30 border border-orange-900 text-orange-400 rounded-lg hover:bg-orange-900/50 disabled:opacity-30"
                    >
                      Hide
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    disabled={actioning === c.id}
                    aria-label="Delete character"
                    className="px-3 py-1.5 text-sm bg-red-900/30 border border-red-900 text-red-400 rounded-lg hover:bg-red-900/50 disabled:opacity-30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
