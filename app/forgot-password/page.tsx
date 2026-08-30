"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { playSound } from "@/lib/utils/sound";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email address");
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) {
        toast.error(error.message);
      } else {
        playSound("matchFound");
        setSent(true);
      }
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
          <h1 className="text-2xl font-bold">Reset password</h1>
          <p className="text-sm text-muted">
            {sent
              ? "Check your email for the reset link."
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-neon-magenta/10 flex items-center justify-center text-xl text-neon-magenta">✓</div>
            <Link
              href="/login"
              className="h-[52px] w-full flex items-center justify-center rounded-full bg-gradient-to-r from-brand-dark to-crimson-600 text-white font-semibold ios-press"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                "Send Reset Link"
              )}
            </button>
            <Link href="/login" className="text-center text-sm text-muted hover:text-foreground-dim transition-colors">
              Back to Login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
