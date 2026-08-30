"use client";

import { useState } from "react";
import { resetPassword } from "@/lib/actions/profile-complete";
import { toast } from "sonner";
import { playSound } from "@/lib/utils/sound";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setPending(true);
    try {
      const result = await resetPassword(password);
      if (result?.error) toast.error(result.error);
      else playSound("revealComplete");
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-void-950 text-white flex items-center justify-center px-6 pb-14 md:pb-0">
      <div className="ios-card bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-8 w-full max-w-md">
        <div className="flex flex-col items-center text-center gap-2 mb-6">
          <span className="font-retro text-[10px] tracking-wider text-neon-magenta neon-text">SWEETSCENE</span>
          <h1 className="text-2xl font-bold">Set new password</h1>
          <p className="text-sm text-muted">Choose a new password for your account.</p>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="New password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-[52px] w-full rounded-[16px] bg-white/5 border border-white/10 px-4 text-base placeholder:text-muted-faint focus:outline-none focus:border-neon-magenta/50"
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-[52px] w-full rounded-[16px] bg-white/5 border border-white/10 px-4 text-base placeholder:text-muted-faint focus:outline-none focus:border-neon-magenta/50"
            required
          />
          <button
            type="submit"
            disabled={pending}
            className="h-[52px] w-full flex items-center justify-center rounded-full bg-gradient-to-r from-brand-dark to-crimson-600 text-white font-semibold ios-press disabled:opacity-50"
          >
            {pending ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Save New Password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
