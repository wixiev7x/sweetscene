"use client";

import { useState } from "react";
import { reportCharacter } from "@/lib/actions/character-social";
import { useAuthModal } from "@/components/auth/AuthModal";

const REASONS: [string, string][] = [
  ["minor", "Looks like a minor"],
  ["real_person", "A real person"],
  ["stolen_image", "Stolen or copyrighted image"],
  ["explicit_unmarked", "Adult content not marked 18+"],
  ["hate_or_harm", "Hate, harassment or harm"],
  ["spam", "Spam or scam"],
  ["other", "Something else"],
];

export default function ReportDialog({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const { openAuth } = useAuthModal();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [err, setErr] = useState("");

  async function send() {
    if (!reason) return setErr("Pick a reason");
    setState("sending");
    const r = await reportCharacter(characterId, reason, note);
    if ("error" in r) {
      setState("idle");
      if (r.error === "auth") return openAuth("signup");
      return setErr(r.error);
    }
    setState("done");
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Report character">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-[420px] rounded-[2rem] bg-[#121214] p-7 ring-1 ring-white/10" style={{ animation: "iosSheetUp .25s var(--ios-ease) both" }}>
        {state === "done" ? (
          <div className="text-center">
            <h2 className="font-display text-2xl text-white">Thanks for telling us</h2>
            <p className="mt-2 text-[15px] text-muted-strong">Our moderators will review it. Reports about minors are handled first.</p>
            <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-full bg-white/[.08] text-white">Done</button>
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl text-white">Report character</h2>
            <div className="mt-4 space-y-1.5">
              {REASONS.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setReason(k); setErr(""); }}
                  aria-pressed={reason === k}
                  className={`flex h-12 w-full items-center justify-between rounded-2xl px-4 text-left text-[15px] transition-colors ${reason === k ? "bg-brand/20 text-white" : "bg-white/[.04] text-foreground-dim hover:bg-white/[.08]"}`}
                >
                  {label}
                  <span className={`h-4 w-4 rounded-full border-2 ${reason === k ? "border-brand bg-brand" : "border-white/25"}`} />
                </button>
              ))}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} placeholder="Anything else? (optional)" className="mt-3 min-h-[80px] w-full rounded-2xl bg-white/[.06] px-4 py-3 text-[15px] text-foreground placeholder:text-muted focus:outline-none" />
            {err && <p className="mt-2 text-sm text-danger">{err}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={onClose} className="h-12 flex-1 rounded-full bg-white/[.06] text-foreground-dim">Cancel</button>
              <button type="button" onClick={send} disabled={state === "sending"} className="h-12 flex-1 rounded-full bg-brand text-white disabled:opacity-60">
                {state === "sending" ? "Sending…" : "Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
