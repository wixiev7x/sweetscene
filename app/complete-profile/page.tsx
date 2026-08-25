"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveProfile } from "@/lib/actions/profile-complete";
import { playSound } from "@/lib/utils/sound";

export default function CompleteProfilePage() {
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pfpUrl, setPfpUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  async function handlePfpUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop();
      const fileName = `${user.id}/pfp-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file);
      if (!uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(fileName);
        setPfpUrl(publicUrl);
      }
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (username.trim().length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    playSound("matchFound");
    startTransition(async () => {
      const result = await saveProfile(username, pfpUrl, password, bio || null);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="min-h-screen bg-void-950 text-white flex items-center justify-center px-6 py-12">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,45,149,0.12)_0%,transparent_60%)]" />
      <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center">
        <span className="text-xs tracking-[0.4em] text-brand/60 uppercase font-retro">
          SweetScene
        </span>
        <h1 className="text-2xl font-light text-foreground mt-4">
          Complete your profile
        </h1>
        <p className="text-sm text-muted mt-2">Set up your anonymous identity.</p>

        <div className="flex flex-col items-center gap-3 mt-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-3xl font-bold text-white shadow-lg overflow-hidden">
            {pfpUrl ? (
              <img
                src={pfpUrl}
                alt="Profile photo"
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <span>{username ? username.charAt(0).toUpperCase() : "?"}</span>
            )}
          </div>
          <label className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-white/10 border border-white/10 hover:bg-white/15 cursor-pointer transition-colors">
            {uploading ? "Uploading…" : "Upload Photo"}
            <input
              type="file"
              accept="image/*"
              onChange={handlePfpUpload}
              className="hidden"
              disabled={uploading || pending}
            />
          </label>
        </div>

        <form onSubmit={handleSubmit} className="w-full mt-6 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Username (2+ characters)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:border-neon-magenta/30"
            autoComplete="username"
            disabled={pending}
            maxLength={20}
          />
          <input
            type="password"
            placeholder="Set a password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:border-neon-magenta/30"
            autoComplete="new-password"
            disabled={pending}
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:border-neon-magenta/30"
            autoComplete="new-password"
            disabled={pending}
          />
          <textarea
            placeholder="Bio (optional — tell people what you're into)"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder-muted-faint focus:outline-none focus:border-neon-magenta/30 resize-none"
            rows={2}
            disabled={pending}
            maxLength={150}
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full px-5 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 active:scale-95 transform transition-all disabled:opacity-50"
          >
            {pending ? "Setting up…" : "Complete Setup"}
          </button>
        </form>

        {error && <p className="text-xs text-danger mt-4">{error}</p>}
      </div>
    </div>
  );
}
