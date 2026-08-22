"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isAdmin,
  listCharacters,
  setCharacterFlag,
  deleteCharacter,
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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [search, setSearch] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const admin = await isAdmin();
      if (!admin) {
        router.replace("/lobby");
        return;
      }
      setAuthorized(true);
      await loadCharacters("");
      setLoading(false);
    })();
  }, [router]);

  async function loadCharacters(s: string) {
    const result = await listCharacters(s, 50, 0);
    if (!("error" in result)) {
      setCharacters(result.characters);
    }
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
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-muted hover:text-foreground-dim">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Character Management</h1>
        </div>

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
    </main>
  );
}