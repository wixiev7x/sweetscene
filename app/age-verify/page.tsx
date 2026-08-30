"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAge } from "@/lib/actions/profile-complete";
import { playSound } from "@/lib/utils/sound";
import { toast } from "sonner";

export default function AgeVerifyPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function handleConfirm() {
    playSound("matchFound");
    setPending(true);
    confirmAge()
      .then((result) => {
        if (result?.error) {
          toast.error(result.error);
          setPending(false);
        }
      })
      .catch(() => {
        toast.error("Something went wrong. Please try again.");
        setPending(false);
      });
  }

  return (
    <main className="min-h-screen bg-void-950 text-white flex items-center justify-center px-6 pb-14 md:pb-0">
      <div className="w-full max-w-md">
        <div className="ios-card bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-neon-magenta/20 flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl text-neon-magenta">18+</span>
          </div>

          <h1 className="text-2xl font-semibold mb-3">Age Verification</h1>
          <p className="text-sm text-muted mb-8 leading-relaxed">
            SweetScene is an anonymous AI matchmaking platform. You must be 18
            or older to continue. This confirmation is recorded once and never
            asked again.
          </p>

          <button
            onClick={handleConfirm}
            disabled={pending}
            className="w-full h-[52px] rounded-full bg-gradient-to-r from-brand-dark to-crimson-600 hover:from-brand hover:to-crimson-500 text-white text-base font-medium ios-press disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
          >
            {pending ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Confirming…
              </>
            ) : (
              "I am 18 or older"
            )}
          </button>

          <button
            onClick={() => router.push("/")}
            disabled={pending}
            className="mt-3 w-full h-[52px] rounded-full bg-white/5 border border-white/10 text-white/70 text-base font-medium ios-press hover:bg-white/10 disabled:opacity-60 transition-all"
          >
            Leave site
          </button>
        </div>

        <p className="text-xs text-muted text-center mt-4">
          False confirmations violate our Terms of Service.
        </p>
      </div>
    </main>
  );
}
