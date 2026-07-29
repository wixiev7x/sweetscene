"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteNav } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  createCharacter,
  importCharacterCardAction,
} from "@/lib/actions/characters";
import { generateCharacterAvatar } from "@/lib/actions/avatars";
import { getMyProfile } from "@/lib/actions/profile";

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

function getCharCountClass(len: number, max: number): string {
  if (len >= max) return "text-red-400";
  if (len >= max * 0.9) return "text-amber-400";
  return "text-muted-faint";
}

type Visibility = "private" | "unlisted" | "public";

/**
 * Character creation page. Full Janitor/SpicyChat parity: name,
 * description, personality traits, first message, example dialog,
 * alternate greetings, scenario tags, SFW/NSFW chat mode, visibility,
 * AI-generated avatar, and Chara v2 card import. The secret system
 * prompt wrapping happens server-side in `lib/actions/characters.ts`.
 */
export default function CreateCharacterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [personalityText, setPersonalityText] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [exampleDialog, setExampleDialog] = useState("");
  const [alternateGreetings, setAlternateGreetings] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isNsfw, setIsNsfw] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  /* Phase 8A — new character fields. */
  const [shortDescription, setShortDescription] = useState("");
  const [fullPersonality, setFullPersonality] = useState("");
  const [backstory, setBackstory] = useState("");
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [category, setCategory] = useState<
    "companion" | "roleplay" | "adventure" | "romance" | "assistant" | "other"
  >("other");
  const [avatarPrompt, setAvatarPrompt] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ is_vip: boolean } | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      /* B4: read VIP status via getMyProfile action (is_vip REVOKED
         from authenticated direct SELECT). */
      const profileResult = await getMyProfile();
      if ("profile" in profileResult) {
        setProfile({ is_vip: profileResult.profile.is_vip });
      }
    }
    fetchProfile();
  }, [router]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length >= 5
          ? prev
          : [...prev, tag]
    );
  }

  function toggleNsfw() {
    if (!profile?.is_vip) {
      setError("NSFW characters require VIP");
      return;
    }
    setIsNsfw((prev) => !prev);
  }

  function addAlternateGreeting() {
    if (alternateGreetings.length >= 3) return;
    setAlternateGreetings((prev) => [...prev, ""]);
  }

  function updateAlternateGreeting(idx: number, value: string) {
    setAlternateGreetings((prev) =>
      prev.map((g, i) => (i === idx ? value.slice(0, 500) : g))
    );
  }

  function removeAlternateGreeting(idx: number) {
    setAlternateGreetings((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleGenerateAvatar() {
    /* Phase 8A: use the free-form avatar prompt field if the user
       filled it in; otherwise fall back to the character prompt. */
    const promptSource = avatarPrompt.trim() || fullPersonality.trim() || userPrompt.trim();
    if (!name.trim() || !promptSource) {
      setError("Fill in name and a description or avatar prompt first.");
      return;
    }
    setGeneratingAvatar(true);
    setError("");
    const result = await generateCharacterAvatar(
      name.trim(),
      promptSource,
      isNsfw
    );
    if ("error" in result) {
      setError(result.error);
    } else {
      setAvatarUrl(result.url);
    }
    setGeneratingAvatar(false);
  }

  async function handleImportCard(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const result = await importCharacterCardAction(raw);
      if ("error" in result) {
        setError(result.error);
      } else {
        /* Pre-fill the form from the indexed card so the user can tweak
           visibility and (optionally) regenerate the avatar before saving. */
        const supabase = createClient();
        const { data } = await supabase
          .from("characters")
          .select("name, user_prompt, personality, first_message, example_dialog, alternate_greetings, scenario_tags, is_nsfw, avatar_url")
          .eq("id", result.characterId)
          .single();
        if (data) {
          setName(data.name ?? "");
          setUserPrompt(data.user_prompt ?? "");
          setPersonalityText((data.personality ?? []).join(", "));
          setFirstMessage(data.first_message ?? "");
          setExampleDialog(data.example_dialog ?? "");
          setAlternateGreetings(data.alternate_greetings ?? []);
          setSelectedTags(data.scenario_tags ?? []);
          setIsNsfw(data.is_nsfw ?? false);
          setAvatarUrl(data.avatar_url ?? null);
          setCreatedId(result.characterId);
          setSuccess(true);
        }
      }
    } catch {
      setError("Invalid card JSON.");
    }
    setImporting(false);
    /* Reset the input so re-importing the same file re-fires onChange. */
    e.target.value = "";
  }

  async function handleSubmit() {
    setError("");
    setSuccess(false);

    if (name.trim().length === 0 || name.trim().length > 50) {
      setError("Name must be 1-50 characters");
      return;
    }
    if (userPrompt.trim().length === 0 || userPrompt.trim().length > 2000) {
      setError("Prompt must be 1-2000 characters");
      return;
    }
    if (selectedTags.length < 1 || selectedTags.length > 5) {
      setError("Select 1-5 scenario tags");
      return;
    }
    if (isNsfw && !profile?.is_vip) {
      setError("NSFW characters require VIP");
      return;
    }

    const personality = personalityText
      .split(/[,;\n]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 30)
      .slice(0, 8);

    setSubmitting(true);

    const result = await createCharacter({
      name: name.trim(),
      user_prompt: userPrompt.trim(),
      scenario_tags: selectedTags,
      is_nsfw: isNsfw,
      is_public: visibility === "public",
      personality,
      first_message: firstMessage.trim() || undefined,
      example_dialog: exampleDialog.trim() || undefined,
      alternate_greetings: alternateGreetings.map((g) => g.trim()).filter(Boolean),
      visibility,
      avatar_url: avatarUrl,
      /* Phase 8A — new fields. */
      short_description: shortDescription.trim() || undefined,
      full_personality: fullPersonality.trim() || undefined,
      backstory: backstory.trim() || undefined,
      tags: customTags,
      category,
    });

    if ("error" in result) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setCreatedId(result.characterId);
    setSuccess(true);
    setSubmitting(false);
  }

  function handleReset() {
    setName("");
    setUserPrompt("");
    setPersonalityText("");
    setFirstMessage("");
    setExampleDialog("");
    setAlternateGreetings([]);
    setSelectedTags([]);
    setIsNsfw(false);
    setVisibility("private");
    setAvatarUrl(null);
    /* Phase 8A — reset new fields. */
    setShortDescription("");
    setFullPersonality("");
    setBackstory("");
    setCustomTags([]);
    setCustomTagInput("");
    setCategory("other");
    setAvatarPrompt("");
    setSuccess(false);
    setCreatedId(null);
    setError("");
  }

  const gIdx = hashGradient(name || "?");
  const [gradFrom, gradTo] = GRADIENTS[gIdx];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(88,28,135,0.08)_0%,transparent_50%)]" />

      <SiteNav />

      <div className="max-w-2xl mx-auto px-6 pt-12 pb-8">
        <h1 className="text-3xl font-light text-foreground tracking-wide">
          Create a Character
        </h1>
        <p className="text-sm text-muted mt-2">
          Design an AI personality. The backend wraps your prompt with
          platform instructions — you control the character; we handle
          the behavior.
        </p>
        <p className="text-xs text-muted-faint mt-2 italic max-w-md">
          Compatible with the Chara v2 card format. Import a card from
          Janitor/SpicyChat, or export yours to take elsewhere.
        </p>
      </div>

      {/* ── SUCCESS STATE ── */}
      {success && createdId ? (
        <div className="max-w-md mx-auto px-6 pb-24">
          <div className="flex flex-col items-center text-center bg-white/5 border border-white/10 rounded-3xl p-10">
            <span className="block text-5xl mb-4">🎉</span>
            <h2 className="text-2xl font-light text-white">Character Saved!</h2>
            <p className="text-sm text-muted mt-2">
              Your character is now stored. Play it solo or list it for the
              community.
            </p>
            <div className="flex flex-col items-center gap-3 mt-8 w-full">
              <Link
                href={`/play/${createdId}`}
                className="block w-full text-center px-8 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-brand-dark to-pink-600 hover:from-brand hover:to-pink-500 active:scale-95 transform transition-all"
              >
                Play Solo →
              </Link>
              <Link
                href={`/characters/${createdId}`}
                className="block w-full text-center px-8 py-3 rounded-xl font-medium text-foreground-dim bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                View Character
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="w-full px-8 py-3 rounded-xl font-medium text-muted-strong bg-white/5 border border-white/10 hover:bg-white/10 hover:text-foreground-dim active:scale-95 transform transition-all"
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-6 pb-24 flex flex-col gap-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl text-center">
              {error}
            </div>
          )}

          {/* ── IMPORT CARD ── */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-2">
              Import Existing Card
            </p>
            <div className="flex items-center gap-3">
              <label className="flex-1 cursor-pointer bg-white/5 border border-white/10 text-foreground-dim text-sm px-4 py-2.5 rounded-lg hover:bg-white/10 transition-all text-center">
                {importing ? "Importing…" : "↑ Upload .json card"}
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportCard}
                  disabled={importing}
                />
              </label>
              <span className="text-xs text-muted-faint">Chara v2 / Pillowcase</span>
            </div>
          </div>

          {/* ── NAME ── */}
          <Field label="Name" hint="Max 50 characters">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="e.g. Shy Librarian"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
            />
            <CharCounter len={name.length} max={50} />
          </Field>

          {/* ── USER PROMPT ── */}
          <Field
            label="Character Prompt"
            hint="The personality. Max 2000 chars. e.g. 'You are a shy librarian who secretly writes romance novels.'"
          >
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Describe your character's personality…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all resize-none min-h-[120px] max-h-[300px]"
            />
            <CharCounter len={userPrompt.length} max={2000} />
          </Field>

          {/* ── PERSONALITY ── */}
          <Field
            label="Personality Traits"
            hint="Comma-separated. Up to 8. e.g. 'shy, witty, dominant, nurturing'"
          >
            <input
              type="text"
              value={personalityText}
              onChange={(e) => setPersonalityText(e.target.value)}
              placeholder="shy, witty, dominant"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
            />
            <p className="text-xs text-muted-faint mt-1">
              {personalityText.split(/[,;\n]/).filter((t) => t.trim().length > 0).length}/8 traits
            </p>
          </Field>

          {/* ── FIRST MESSAGE ── */}
          <Field label="First Message (Greeting)" hint="Optional. Max 500 chars. The AI's opener when chat starts.">
            <textarea
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Oh… I didn't expect anyone in this aisle. Can I help you find something?"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all resize-none"
            />
            <CharCounter len={firstMessage.length} max={500} />
          </Field>

          {/* ── EXAMPLE DIALOG ── */}
          <Field label="Example Dialog" hint="Optional. Max 2000 chars. Few-shot samples showing the AI how to speak.">
            <textarea
              value={exampleDialog}
              onChange={(e) => setExampleDialog(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder={`{{user}}: Hi.\n{{char}}: *looks up, blushing* O-oh. Hello. Did you need… a book?`}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all resize-none min-h-[120px] max-h-[300px]"
            />
            <CharCounter len={exampleDialog.length} max={2000} />
          </Field>

          {/* ── ALTERNATE GREETINGS ── */}
          <Field
            label="Alternate Greetings"
            hint="Optional. Up to 3. Different start lines the user can rotate between."
          >
            <div className="flex flex-col gap-2">
              {alternateGreetings.map((g, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={g}
                    onChange={(e) => updateAlternateGreeting(i, e.target.value)}
                    maxLength={500}
                    placeholder={`Greeting ${i + 1}`}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeAlternateGreeting(i)}
                    className="px-3 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400 hover:bg-red-500/10 transition-all text-sm"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {alternateGreetings.length < 3 && (
                <button
                  type="button"
                  onClick={addAlternateGreeting}
                  className="self-start text-sm text-brand-light hover:text-brand-lighter transition-colors mt-1"
                >
                  + Add greeting
                </button>
              )}
            </div>
          </Field>

          {/* ── PHASE 8A: SHORT DESCRIPTION ── */}
          <Field label="Short Description" hint="One line shown on cards. Max 200 chars. e.g. 'A shy librarian who writes romance novels.'">
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              maxLength={200}
              placeholder="A shy librarian who secretly writes romance novels…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
            />
            <CharCounter len={shortDescription.length} max={200} />
          </Field>

          {/* ── PHASE 8A: FULL PERSONALITY ── */}
          <Field label="Full Personality" hint="How the character talks, behaves, tone, quirks, speech patterns. Max 3000 chars.">
            <textarea
              value={fullPersonality}
              onChange={(e) => setFullPersonality(e.target.value)}
              maxLength={3000}
              rows={5}
              placeholder="Speaks softly, often trailing off mid-sentence. Stammers when nervous. Observant — notices small details about people. Uses literary references. Warm but guarded…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all resize-none min-h-[120px] max-h-[300px]"
            />
            <CharCounter len={fullPersonality.length} max={3000} />
          </Field>

          {/* ── PHASE 8A: BACKSTORY ── */}
          <Field label="Backstory" hint="Who the character is, their background and lore. Max 3000 chars.">
            <textarea
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              maxLength={3000}
              rows={5}
              placeholder="Grew up in a coastal town. Moved to the city for university. Works at the public library. Lost a sibling young — never talks about it…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all resize-none min-h-[120px] max-h-[300px]"
            />
            <CharCounter len={backstory.length} max={3000} />
          </Field>

          {/* ── PHASE 8A: CHAR TAGS (new system) ── */}
          <Field label="Tags" hint="Help users discover your character. Pick from suggestions or type custom. Up to 10.">
            <div className="flex flex-wrap gap-2">
              {["flirty", "funny", "serious", "shy", "dominant", "caring", "mysterious", "anime", "fantasy", "realistic"].map((t) => {
                const sel = customTags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      if (sel) {
                        setCustomTags(customTags.filter((x) => x !== t));
                      } else if (customTags.length < 10) {
                        setCustomTags([...customTags, t]);
                      }
                    }}
                    className={[
                      "px-3 py-1.5 rounded-full text-sm border transition-all capitalize",
                      sel
                        ? "border-brand/50 bg-brand/10 text-brand-lighter"
                        : "border-white/10 bg-white/5 text-muted-strong hover:border-white/20",
                    ].join(" ")}
                  >
                    {t}
                  </button>
                );
              })}
              {/* custom tags already added */}
              {customTags
                .filter((t) => !["flirty","funny","serious","shy","dominant","caring","mysterious","anime","fantasy","realistic"].includes(t))
                .map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-pink-500/30 bg-pink-500/10 text-pink-300"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => setCustomTags(customTags.filter((x) => x !== t))}
                      className="text-xs hover:text-red-400"
                    >
                      &times;
                    </button>
                  </span>
                ))}
            </div>
            {/* add custom tag */}
            {customTags.length < 10 && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  maxLength={20}
                  placeholder="add custom tag…"
                  className="w-40 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-brand/50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customTagInput.trim()) {
                      e.preventDefault();
                      const v = customTagInput.trim().toLowerCase();
                      if (!customTags.includes(v)) {
                        setCustomTags([...customTags, v]);
                      }
                      setCustomTagInput("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = customTagInput.trim().toLowerCase();
                    if (v && !customTags.includes(v)) {
                      setCustomTags([...customTags, v]);
                    }
                    setCustomTagInput("");
                  }}
                  className="text-xs text-brand-light hover:text-brand-lighter transition-colors"
                >
                  + add
                </button>
              </div>
            )}
            <p className="text-xs text-muted-faint mt-1">({customTags.length}/10 tags)</p>
          </Field>

          {/* ── PHASE 8A: CATEGORY ── */}
          <Field label="Category" hint="What kind of character is this?">
            <div className="flex flex-wrap gap-2">
              {(["companion","roleplay","adventure","romance","assistant","other"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={[
                    "flex-1 min-w-[100px] px-4 py-2.5 rounded-xl text-sm capitalize border transition-all",
                    category === c
                      ? "border-brand/50 bg-brand/10 text-brand-lighter"
                      : "border-white/10 bg-white/5 text-muted-strong hover:border-white/20",
                  ].join(" ")}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          {/* ── SCENARIO TAGS ── */}
          <Field label="Scenario Tags" hint="Select 1-5 tags. These determine which scenes your character fits.">
            <div className="flex flex-wrap gap-2">
              {SCENARIO_TAGS.map((tag) => {
                const sel = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={[
                      "px-3 py-1.5 rounded-full text-sm border transition-all duration-200 capitalize",
                      sel
                        ? "border-brand/50 bg-brand/10 text-brand-lighter"
                        : "border-white/10 bg-white/5 text-muted-strong hover:border-white/20",
                    ].join(" ")}
                  >
                    {tag.replace(/_/g, " ")}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-faint mt-2">({selectedTags.length}/5 selected)</p>
          </Field>

          {/* ── NSFW ── */}
          <Field label="NSFW Content" hint={profile?.is_vip ? "Enable for uncensored roleplay." : "NSFW requires VIP."}>
            <button
              type="button"
              onClick={toggleNsfw}
              disabled={!profile?.is_vip}
              className={[
                "relative w-12 h-6 rounded-full transition-all duration-300",
                !profile?.is_vip ? "opacity-50 cursor-not-allowed" : "",
                isNsfw ? "bg-gradient-to-r from-brand-dark to-pink-600" : "bg-surface-raised",
              ].join(" ")}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-300 ${isNsfw ? "left-7" : "left-0.5"}`} />
            </button>
          </Field>

          {/* ── VISIBILITY ── */}
          <Field label="Visibility" hint="Private = only you. Unlisted = link-only. Public = appears in Browse.">
            <div className="flex gap-2">
              {(["private", "unlisted", "public"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={[
                    "flex-1 px-4 py-2.5 rounded-xl text-sm capitalize border transition-all",
                    visibility === v
                      ? "border-brand/50 bg-brand/10 text-brand-lighter"
                      : "border-white/10 bg-white/5 text-muted-strong hover:border-white/20",
                  ].join(" ")}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>

          {/* ── AVATAR ── */}
          <Field label="Avatar" hint="Type a description to AI-generate a tasteful SFW portrait, or upload your own later. Pollinations, free.">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover shrink-0" />
              ) : (
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${gradFrom} ${gradTo} flex items-center justify-center shrink-0`}>
                  <span className="text-2xl text-white font-bold">
                    {name.trim() ? name.trim().charAt(0).toUpperCase() : "?"}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={handleGenerateAvatar}
                disabled={generatingAvatar || !name.trim()}
                className="px-5 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground-dim hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingAvatar ? "Painting…" : "🎨 Generate Avatar"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="text-xs text-muted hover:text-red-400 transition-colors"
                >
                  remove
                </button>
              )}
            </div>
            {/* Phase 8A: free-form avatar prompt. */}
            <input
              type="text"
              value={avatarPrompt}
              onChange={(e) => setAvatarPrompt(e.target.value)}
              maxLength={300}
              placeholder="Avatar prompt: e.g. 'red haired anime girl, green eyes, shy smile'"
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-brand/50"
            />
          </Field>

          {/* ── SUBMIT ── */}
          <div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className={[
                "w-full py-4 rounded-xl font-medium text-lg transition-all duration-300",
                submitting
                  ? "bg-line-strong text-muted-strong cursor-not-allowed"
                  : "bg-gradient-to-r from-brand-dark to-pink-600 text-white hover:from-brand hover:to-pink-500 active:scale-95",
              ].join(" ")}
            >
              {submitting ? "Creating…" : "Create Character →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground-dim">{label}</label>
      {hint && <p className="text-xs text-muted-faint mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function CharCounter({ len, max }: { len: number; max: number }) {
  return (
    <div className="flex justify-end mt-1">
      <span className={["text-xs", getCharCountClass(len, max)].join(" ")}>
        {len}/{max}
      </span>
    </div>
  );
}