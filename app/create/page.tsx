"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { playSound } from "@/lib/utils/sound";
import { createClient } from "@/lib/supabase/client";

const GENRES = ["Romance", "Mystery", "Fantasy", "Sci-Fi", "Slice of Life", "Thriller"];
const STYLES = ["Casual", "Formal", "Poetic", "Dark", "Playful", "Mysterious"];
const GENDERS = ["Female", "Male", "Other"];

const inputClass =
  "w-full bg-surface-sunken border border-line rounded-[var(--radius-control)] px-4 py-3 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:ring-2 focus:ring-line-focus focus:border-line-focus transition-colors";

export default function CreatePage() {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [personality, setPersonality] = useState("");
  const [openingLine, setOpeningLine] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [isNsfw, setIsNsfw] = useState(false);
  const [gender, setGender] = useState("other");
  const [published, setPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggle(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
    playSound("click");
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4MB");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Log in to upload artwork");
        return;
      }
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/characters/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
      playSound("click");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("bots").insert({
        name: name.trim(),
        tagline: tagline.trim(),
        personality: personality.trim(),
        opening_line: openingLine.trim(),
        is_nsfw: isNsfw,
        gender,
        genres,
        styles,
        image_url: imageUrl,
      });

      if (error) throw error;

      playSound("matchFound");
      toast.success("Character published successfully!");
      setPublished(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish character";
      toast.error(message);
      playSound("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (published) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4 text-success">&#x2713;</div>
          <h1 className="text-3xl font-display mb-3">Character published!</h1>
          <p className="text-sm text-muted mb-8">It goes live in Explore right away — our moderation team reviews every new host.</p>
          <Link href="/explore" className="px-8 py-3 rounded-full font-medium text-accent-foreground bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-light active:scale-95 transform transition-all inline-block focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none">
            View in Explore →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-[0.2em] text-accent-candle font-mono mb-2">The workshop</p>
        <h1 className="text-3xl md:text-4xl font-display mb-2">Create a character</h1>
        <p className="text-sm text-muted mb-6">
          Design an AI personality for others to meet. Upload artwork so they find you in the dark.
        </p>

        <div className="bg-accent-candle/5 border border-accent-candle/30 rounded-[var(--radius-card)] p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-accent-candle">You need an account to publish characters.</p>
          <Link href="/login" className="text-xs text-accent-candle underline hover:text-accent-candle-deep focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none">
            Login →
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-xs text-muted uppercase tracking-wider mb-2 block">Character artwork</label>
            <div className="flex items-start gap-4">
              <div className="relative w-28 h-36 rounded-[var(--radius-control)] overflow-hidden border border-line bg-surface-sunken flex-shrink-0">
                {imageUrl ? (
                  <img src={imageUrl} alt="Character artwork preview" className="absolute inset-0 w-full h-full object-cover" />
                ) : uploading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="w-5 h-5 border-2 border-line-strong border-t-accent-candle rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-4xl font-display text-muted-faint">
                    {name[0] || "?"}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 rounded-full border border-line text-sm text-foreground hover:border-accent-candle hover:text-accent-candle transition-colors focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : imageUrl ? "Replace image" : "Upload image"}
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="ml-2 px-4 py-2 rounded-full border border-line text-sm text-muted hover:border-danger hover:text-danger transition-colors focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
                  >
                    Remove
                  </button>
                )}
                <p className="text-xs text-muted mt-2">Portrait 3:4 works best. PNG/JPG up to 4MB. Without artwork we generate candlelit art from the name.</p>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wider mb-2 block">Character name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="A short, intriguing name…" required className={inputClass} />
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wider mb-2 block">Tagline</label>
            <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="A short, intriguing description…" required className={inputClass} />
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wider mb-2 block">Personality description</label>
            <textarea value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="Describe how this character thinks, speaks, and behaves." required rows={4} className={`${inputClass} resize-none`} />
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wider mb-2 block">Opening line</label>
            <textarea value={openingLine} onChange={(e) => setOpeningLine(e.target.value)} placeholder="What does this character say first? Set the scene…" required rows={3} className={`${inputClass} resize-none`} />
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wider mb-2 block">Gender presentation</label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Gender presentation">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setGender(g.toLowerCase());
                    playSound("click");
                  }}
                  aria-pressed={gender === g.toLowerCase()}
                  className={`px-4 py-1.5 rounded-full text-sm border transition-colors focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none ${
                    gender === g.toLowerCase()
                      ? "bg-accent-rose/15 border-accent-rose/40 text-accent-rose"
                      : "bg-surface-sunken border-line text-muted hover:text-foreground hover:border-line-strong"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-faint mt-2">Used to tailor solo recommendations — never shown as a label.</p>
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wider mb-2 block">Genres</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button key={g} type="button" onClick={() => toggle(genres, setGenres, g)}
                  className={`px-4 py-1.5 rounded-full text-sm border transition-colors focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none ${genres.includes(g) ? "bg-accent-candle/15 border-accent-candle/40 text-accent-candle" : "bg-surface-sunken border-line text-muted hover:text-foreground hover:border-line-strong"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted uppercase tracking-wider mb-2 block">Styles</label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button key={s} type="button" onClick={() => toggle(styles, setStyles, s)}
                  className={`px-4 py-1.5 rounded-full text-sm border transition-colors focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none ${styles.includes(s) ? "bg-accent-candle/15 border-accent-candle/40 text-accent-candle" : "bg-surface-sunken border-line text-muted hover:text-foreground hover:border-line-strong"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isNsfw} onChange={(e) => setIsNsfw(e.target.checked)} className="accent-accent-rose w-4 h-4" />
            <span className="text-sm text-muted">This character contains adult content (18+)</span>
          </label>

          <button type="submit" disabled={!name || !tagline || !personality || !openingLine || submitting}
            className="w-full px-6 py-3.5 rounded-full font-medium text-accent-foreground bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-light active:scale-[0.98] transform transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none flex items-center justify-center gap-2">
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                Publishing…
              </>
            ) : (
              "Publish character"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
