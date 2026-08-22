"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCharacter, updateCharacter } from "@/lib/actions/characters";
import { getMyProfile } from "@/lib/actions/profile";
import { LoadingState } from "@/components/ui";

/* ════════════════════════════════════════════════════════════════════
 * Character edit.
 *
 * `updateCharacter` existed with full ownership and safety checks but
 * had no caller — and two Edit buttons (characters/my and the character
 * detail page) linked here, to a route that did not exist. Both 404'd.
 *
 * The form sends a partial patch: only fields the user actually changed
 * are included, so an edit can never clobber a field it didn't render.
 * Ownership is enforced server-side by RLS plus an explicit creator_id
 * check; the redirect here is a convenience, not the gate.
 * ════════════════════════════════════════════════════════════════════ */

const SCENARIO_TAGS = [
  "hospital",
  "coffee_shop",
  "mansion",
  "library",
  "gym",
  "noir_office",
  "restaurant",
  "fitness",
  "clinic",
  "home",
  "service",
  "mystery",
];

const CATEGORIES = [
  "companion",
  "roleplay",
  "adventure",
  "romance",
  "assistant",
  "other",
] as const;

type Visibility = "private" | "unlisted" | "public";
type Category = (typeof CATEGORIES)[number];

const MAX_TAGS = 3;

function countClass(len: number, max: number): string {
  if (len >= max) return "text-red-400";
  if (len >= max * 0.9) return "text-amber-400";
  return "text-muted-faint";
}

export default function EditCharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isVip, setIsVip] = useState(false);

  /* The values as loaded, so the patch can carry only real changes. */
  const [initial, setInitial] = useState<Record<string, unknown> | null>(null);

  const [name, setName] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [fullPersonality, setFullPersonality] = useState("");
  const [backstory, setBackstory] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [exampleDialog, setExampleDialog] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isNsfw, setIsNsfw] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [category, setCategory] = useState<Category>("roleplay");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [charResult, profileResult] = await Promise.all([
        getCharacter(id),
        getMyProfile(),
      ]);
      if (cancelled) return;

      if ("error" in charResult) {
        setError(charResult.error);
        setLoading(false);
        return;
      }

      const c = charResult.character as unknown as Record<string, unknown>;

      /* getCharacter returns the public shape to non-creators, so this
         is the only client-side signal that the user owns the row. The
         server re-checks regardless. */
      if (!("version" in charResult.character)) {
        setError("You can only edit your own characters");
        setLoading(false);
        return;
      }

      setInitial(c);
      setName((c.name as string) ?? "");
      setUserPrompt((c.user_prompt as string) ?? "");
      setShortDescription((c.short_description as string) ?? "");
      setFullPersonality((c.full_personality as string) ?? "");
      setBackstory((c.backstory as string) ?? "");
      setFirstMessage((c.first_message as string) ?? "");
      setExampleDialog((c.example_dialog as string) ?? "");
      setSelectedTags((c.scenario_tags as string[]) ?? []);
      setIsNsfw(Boolean(c.is_nsfw));
      setVisibility(((c.visibility as Visibility) ?? "private") as Visibility);
      setCategory(((c.category as Category) ?? "roleplay") as Category);

      if (!("error" in profileResult)) {
        setIsVip(Boolean(profileResult.profile.is_vip));
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length >= MAX_TAGS
          ? prev
          : [...prev, tag]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !initial) return;

    setError("");
    setSaved(false);

    if (!name.trim()) return setError("Name is required");
    if (!userPrompt.trim()) return setError("Prompt is required");
    if (selectedTags.length < 1) return setError("Select at least one scenario tag");

    /* Send only what changed. A field the user never touched stays
       absent from the patch, and updateCharacter leaves it alone. */
    const patch: Record<string, unknown> = {};
    const diff = (key: string, current: unknown, original: unknown) => {
      if (JSON.stringify(current) !== JSON.stringify(original)) {
        patch[key] = current;
      }
    };

    diff("name", name.trim(), initial.name ?? "");
    diff("user_prompt", userPrompt.trim(), initial.user_prompt ?? "");
    diff("short_description", shortDescription.trim(), initial.short_description ?? "");
    diff("full_personality", fullPersonality.trim(), initial.full_personality ?? "");
    diff("backstory", backstory.trim(), initial.backstory ?? "");
    diff("first_message", firstMessage.trim(), initial.first_message ?? "");
    diff("example_dialog", exampleDialog.trim(), initial.example_dialog ?? "");
    diff("scenario_tags", selectedTags, initial.scenario_tags ?? []);
    diff("is_nsfw", isNsfw, Boolean(initial.is_nsfw));
    diff("visibility", visibility, initial.visibility ?? "private");
    diff("category", category, initial.category ?? "roleplay");

    if (Object.keys(patch).length === 0) {
      setSaved(true);
      return;
    }

    setSaving(true);
    const result = await updateCharacter(id, patch);
    setSaving(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setSaved(true);
    router.push(`/characters/${id}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <LoadingState text="Loading character…" />
      </main>
    );
  }

  if (error && !initial) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted-strong">{error}</p>
        <Link
          href="/characters/my"
          className="text-sm text-brand-light hover:text-brand-lighter transition-colors"
        >
          ← Back to my characters
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link
          href={`/characters/${id}`}
          className="text-sm text-muted hover:text-foreground-dim transition-colors"
        >
          ← Back
        </Link>
        <h1 className="mt-3 text-3xl font-bold">Edit character</h1>
        <p className="mt-1 text-sm text-muted">
          Changes apply to new scenes. Conversations already running keep the
          version they started with.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
          />
          <div className={`mt-1 text-right text-xs ${countClass(name.length, 50)}`}>
            {name.length}/50
          </div>
        </div>

        <div>
          <label htmlFor="prompt" className="block text-sm font-medium mb-2">
            Prompt
          </label>
          <p className="mb-2 text-xs text-muted">
            How the character behaves in a scene. Editing this re-wraps the
            system prompt and bumps the version.
          </p>
          <textarea
            id="prompt"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            maxLength={2000}
            rows={5}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all resize-none"
          />
          <div className={`mt-1 text-right text-xs ${countClass(userPrompt.length, 2000)}`}>
            {userPrompt.length}/2000
          </div>
        </div>

        <div>
          <label htmlFor="short-desc" className="block text-sm font-medium mb-2">
            Short description
          </label>
          <input
            id="short-desc"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            maxLength={200}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
          />
        </div>

        <div>
          <label htmlFor="personality" className="block text-sm font-medium mb-2">
            Personality
          </label>
          <textarea
            id="personality"
            value={fullPersonality}
            onChange={(e) => setFullPersonality(e.target.value)}
            maxLength={3000}
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all resize-none"
          />
        </div>

        <div>
          <label htmlFor="backstory" className="block text-sm font-medium mb-2">
            Backstory
          </label>
          <textarea
            id="backstory"
            value={backstory}
            onChange={(e) => setBackstory(e.target.value)}
            maxLength={3000}
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all resize-none"
          />
        </div>

        <div>
          <label htmlFor="first-message" className="block text-sm font-medium mb-2">
            First message
          </label>
          <textarea
            id="first-message"
            value={firstMessage}
            onChange={(e) => setFirstMessage(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all resize-none"
          />
        </div>

        <div>
          <label htmlFor="example-dialog" className="block text-sm font-medium mb-2">
            Example dialog
          </label>
          <p className="mb-2 text-xs text-muted">
            Use <code className="font-mono">{"{{user}}:"}</code> and{" "}
            <code className="font-mono">{"{{char}}:"}</code> line prefixes.
          </p>
          <textarea
            id="example-dialog"
            value={exampleDialog}
            onChange={(e) => setExampleDialog(e.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all resize-none font-mono text-sm"
          />
        </div>

        <div>
          <span className="block text-sm font-medium mb-2">
            Scenario tags{" "}
            <span className="text-muted font-normal">
              ({selectedTags.length}/{MAX_TAGS})
            </span>
          </span>
          <div className="flex flex-wrap gap-2">
            {SCENARIO_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              const full = selectedTags.length >= MAX_TAGS && !active;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  disabled={full}
                  className={`px-3 py-1.5 rounded-full text-xs capitalize transition-all ${
                    active
                      ? "bg-brand/20 text-brand-lighter border border-brand/40"
                      : full
                        ? "bg-white/5 text-muted-faint border border-white/5 cursor-not-allowed"
                        : "bg-white/5 text-muted-strong border border-white/10 hover:border-brand/30"
                  }`}
                >
                  {tag.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-2">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all capitalize"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-surface capitalize">
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="visibility" className="block text-sm font-medium mb-2">
            Visibility
          </label>
          <select
            id="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all"
          >
            <option value="private" className="bg-surface">
              Private — only you
            </option>
            <option value="unlisted" className="bg-surface">
              Unlisted — anyone with the link
            </option>
            <option value="public" className="bg-surface">
              Public — listed in browse
            </option>
          </select>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isNsfw}
              onChange={(e) => setIsNsfw(e.target.checked)}
              disabled={!isVip && !Boolean(initial?.is_nsfw)}
              className="mt-1 accent-brand"
            />
            <span>
              <span className="block text-sm font-medium">NSFW</span>
              <span className="block text-xs text-muted mt-0.5">
                {!isVip && !Boolean(initial?.is_nsfw)
                  ? "Marking a character NSFW requires VIP."
                  : "Only shown to users verified as 18+."}
              </span>
            </span>
          </label>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {saved && !error && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-success">
            Saved.
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-white text-black font-medium py-3 rounded-xl hover:bg-foreground-dim disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <Link
            href={`/characters/${id}`}
            className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-muted-strong hover:bg-white/10 transition-all"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
