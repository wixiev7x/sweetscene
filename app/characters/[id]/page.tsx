"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getCharacter,
  exportCharacterCardAction,
} from "@/lib/actions/characters";

type Character = {
  id: string;
  name: string;
  user_prompt: string;
  scenario_tags: string[];
  is_nsfw: boolean;
  personality: string[];
  first_message: string | null;
  example_dialog: string | null;
  alternate_greetings: string[];
  visibility: string;
  avatar_url: string | null;
  connection_score: number;
  creator_id: string | null;
  is_public: boolean;
  version: number;
  updated_at: string;
};

const GRADIENTS = [
  ["from-purple-500", "to-pink-500"],
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
 * Character detail page. Shows the full public-or-owned card — avatar,
 * personality chips, first message, alternate greetings, scenario
 * tags, connection score, and play actions. Owner sees Edit and Export
 * controls; visitors see only Play Solo and (when public) the card.
 */
export default function CharacterDetailPage() {
  const params = useParams<{ id: string }>();
  const characterId = params.id;

  const [character, setCharacter] = useState<Character | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const result = await getCharacter(characterId);
      if ("error" in result) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const char = result.character as Character;
      setCharacter(char);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setIsOwner(char.creator_id === user.id);

      setLoading(false);
    }
    load();
  }, [characterId]);

  async function handleExport() {
    const result = await exportCharacterCardAction(characterId);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    const blob = new Blob([JSON.stringify(result.card, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${character?.name ?? "character"}.card.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
        <p className="text-gray-500 text-sm">Loading character…</p>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 text-sm">{error || "Character not found"}</p>
        <Link
          href="/characters"
          className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          ← Back to Characters
        </Link>
      </div>
    );
  }

  const gIdx = hashGradient(character.name);
  const [gradFrom, gradTo] = GRADIENTS[gIdx];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(88,28,135,0.08)_0%,transparent_50%)]" />

      <nav className="sticky top-0 z-10 border-b border-white/5 backdrop-blur-md bg-black/40 px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-xl font-bold text-purple-400 hover:text-purple-300 transition-colors"
        >
          chatty
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/lobby" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Lobby
          </Link>
          <Link href="/characters" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Characters
          </Link>
          <Link href="/characters/my" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Mine
          </Link>
          <Link href="/profile" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Profile
          </Link>
        </div>
      </nav>

      <main className="relative z-0 max-w-3xl mx-auto px-6 py-12">
        {/* ── HERO ── */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 bg-white/5 border border-white/10 rounded-2xl p-8">
          {character.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.avatar_url}
              alt={character.name}
              className="w-24 h-24 rounded-2xl object-cover shrink-0"
            />
          ) : (
            <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${gradFrom} ${gradTo} flex items-center justify-center shrink-0`}>
              <span className="text-3xl text-white font-bold">
                {character.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
              <h1 className="text-2xl font-medium text-white">{character.name}</h1>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${character.is_nsfw ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"}`}>
                {character.is_nsfw ? "NSFW" : "SFW"}
              </span>
              {character.visibility !== "private" && (
                <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {character.visibility}
                </span>
              )}
            </div>

            {character.connection_score > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                ◆ {character.connection_score} connections
              </p>
            )}

            {/* tags */}
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-3">
              {character.scenario_tags.map((t) => (
                <span key={t} className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400 capitalize">
                  {t.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── PERSONALITY ── */}
        {character.personality.length > 0 && (
          <Section title="Personality">
            <div className="flex flex-wrap gap-2">
              {character.personality.map((p) => (
                <span key={p} className="text-xs px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  {p}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* ── DESCRIPTION ── */}
        <Section title="Character">
          <div className="text-sm text-gray-300 leading-relaxed bg-white/5 rounded-xl p-4">
            {character.user_prompt}
          </div>
        </Section>

        {/* ── FIRST MESSAGE ── */}
        {character.first_message && (
          <Section title="First Message">
            <div className="text-sm text-gray-200 italic leading-relaxed bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
              {character.first_message}
            </div>
          </Section>
        )}

        {/* ── ALTERNATE GREETINGS ── */}
        {character.alternate_greetings.length > 0 && (
          <Section title={`Alternate Greetings (${character.alternate_greetings.length})`}>
            <div className="flex flex-col gap-3">
              {character.alternate_greetings.map((g, i) => (
                <div key={i} className="text-sm text-gray-400 italic leading-relaxed bg-white/5 rounded-xl p-3 border-l-2 border-purple-500/30">
                  {g}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── ACTIONS ── */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <Link
            href={`/play/${character.id}`}
            className="text-center flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium py-3 rounded-xl hover:from-purple-500 hover:to-pink-500 active:scale-95 transform transition-all"
          >
            ▶ Play Solo
          </Link>
          {isOwner && (
            <Link
              href={`/characters/${character.id}/edit`}
              className="text-center flex-1 bg-white/5 border border-white/10 text-gray-300 font-medium py-3 rounded-xl hover:bg-white/10 transition-all"
            >
              ✎ Edit
            </Link>
          )}
          <button
            type="button"
            onClick={handleExport}
            className="text-center flex-1 bg-white/5 border border-white/10 text-gray-300 font-medium py-3 rounded-xl hover:bg-white/10 transition-all"
          >
            ↓ Export Card
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center mt-4">{error}</p>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
        {title}
      </p>
      {children}
    </section>
  );
}