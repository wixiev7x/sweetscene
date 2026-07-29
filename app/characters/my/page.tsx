"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SiteNav, Spinner } from "@/components/ui";
import { getUserCharacters, deleteCharacter, type CharacterOwned } from "@/lib/actions/characters";

const GRADIENTS = [
  ["from-brand", "to-pink-500"],
  ["from-blue-500", "to-cyan-500"],
  ["from-amber-500", "to-red-500"],
  ["from-green-500", "to-teal-500"],
  ["from-indigo-500", "to-violet-500"],
] as const;

function hashGradient(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return sum % GRADIENTS.length;
}

/**
 * "My Characters" — grid of every character the current user has created,
 * regardless of visibility. Includes Edit + Delete actions. Highlights
 * connection_score so creators can see which characters are matchmaking
 * gold.
 */
export default function MyCharactersPage() {
  const [characters, setCharacters] = useState<CharacterOwned[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const result = await getUserCharacters();
      if ("error" in result) {
        setError(result.error);
      } else {
        setCharacters(result.characters);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this character? In-flight matches keep their snapshot.")) return;
    setDeletingId(id);
    const result = await deleteCharacter(id);
    if ("error" in result) {
      setError(result.error);
    } else {
      setCharacters((prev) => prev.filter((c) => c.id !== id));
    }
    setDeletingId(null);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(88,28,135,0.08)_0%,transparent_50%)]" />

      <SiteNav />

      <main className="relative z-0 max-w-6xl mx-auto px-6 pt-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light text-foreground tracking-wide">My Characters</h1>
            <p className="text-sm text-muted mt-2">
              Every character you&apos;ve created. Edit, export, or delete at will.
            </p>
          </div>
          <Link
            href="/create-character"
            className="bg-gradient-to-r from-brand-dark to-pink-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:from-brand hover:to-pink-500 active:scale-95 transform transition-all"
          >
            + New Character
          </Link>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <Spinner />
            <p className="text-muted text-sm">Loading your characters…</p>
          </div>
        ) : characters.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-muted-strong text-sm">You haven&apos;t created any characters yet.</p>
            <Link
              href="/create-character"
              className="mt-3 text-sm text-brand-light hover:text-brand-lighter transition-colors"
            >
              Create your first character →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pb-24">
            {characters.map((c) => {
              const gIdx = hashGradient(c.name);
              const [from, to] = GRADIENTS[gIdx];
              return (
                <div key={c.id} className="relative bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-brand/30 transition-all duration-300 group">
                  {/* visibility badge */}
                  <span className={`absolute top-3 right-3 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${c.visibility === "public" ? "bg-brand/10 text-brand-light border-brand/20" : c.visibility === "unlisted" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-muted/10 text-muted-strong border-line-focus/20"}`}>
                    {c.visibility}
                  </span>

                  <Link href={`/characters/${c.id}`} className="block">
                    {/* avatar */}
                    {c.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatar_url} alt={c.name} className="w-14 h-14 rounded-xl object-cover" />
                    ) : (
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${from} ${to} flex items-center justify-center`}>
                        <span className="text-xl text-white font-bold">{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <h3 className="text-lg font-medium text-white mt-3 truncate">{c.name}</h3>
                    <p className="text-xs text-muted mt-1">
                      {c.is_nsfw ? "NSFW" : "SFW"} · ◆ {c.connection_score} · v{c.version}
                    </p>
                    <p className="text-xs text-muted-strong mt-3 line-clamp-2">{c.user_prompt}</p>
                  </Link>

                  <div className="flex gap-2 mt-4">
                    <Link
                      href={`/characters/${c.id}/edit`}
                      className="flex-1 text-center text-xs text-foreground-dim bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={deletingId === c.id}
                      onClick={() => handleDelete(c.id)}
                      className="flex-1 text-xs text-red-400 bg-red-500/5 border border-red-500/10 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-all disabled:opacity-50"
                    >
                      {deletingId === c.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}