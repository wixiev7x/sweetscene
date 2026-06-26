"use client";

import { useState } from "react";
import {
  sanitizeAndScrub,
  containsBlockedTerm,
} from "@/lib/utils/safety";

type ChatBoxProps = {
  isLocked: boolean;
  isEnded: boolean;
  isRevealed: boolean;
  errorMessage: string;
  onSend: (message: string) => void;
};

/**
 * Chat input box for the chatty platform. Renders in one of four visual
 * states — unlocked (normal), locked (AI typing), ended/revealed, or
 * transient error — each with distinct styling and interactions.
 */
export default function ChatBox({
  isLocked,
  isEnded,
  isRevealed,
  errorMessage,
  onSend,
}: ChatBoxProps) {
  const [input, setInput] = useState("");
  const [localError, setLocalError] = useState("");

  /**
   * Validates and fires onSend if the trimmed message is non-empty.
   * Three-step gate: empty → reject; blocked term → refuse without
   * sending; otherwise redact PII + scrub injection patterns, then
   * hand the cleaned text to the parent's onSend.
   */
  function handleSend() {
    const trimmed = input.trim();
    if (trimmed.length === 0) return;

    /* Hard refusal: never persist, never show to the AI, never echo
       the offending term back to the user. */
    if (containsBlockedTerm(trimmed)) {
      setLocalError("Message blocked.");
      setInput("");
      return;
    }

    onSend(sanitizeAndScrub(trimmed));
    setLocalError("");
    setInput("");
  }

  /**
   * Determines whether the character count should show a warning colour.
   */
  function getCharCountClass(): string {
    const len = input.length;
    if (len >= 500) return "text-red-400";
    if (len > 450) return "text-amber-400";
    return "text-gray-500";
  }

  /**
   * Determines whether the send button should be blocked because the
   * input is empty or exceeds the character limit.
   */
  function isSendDisabled(): boolean {
    return input.trim().length === 0 || input.length > 500;
  }

  const showError = errorMessage.length > 0 || localError.length > 0;
  const showEnded = isEnded || isRevealed;
  const displayError = localError || errorMessage;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/80 via-black/60 to-transparent backdrop-blur-md">
      <div
        className={[
          "max-w-3xl mx-auto transition-all duration-300",
          showEnded
            ? "rounded-2xl border border-white/10 bg-white/5"
            : "rounded-2xl border border-white/10 bg-white/5 p-3",
        ].join(" ")}
      >
        {/* ── ERROR BANNER ── */}
        {showError && !showEnded && (
          <div className="mb-3 flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-lg">
            <span className="shrink-0">&#9888;</span>
            <span>{displayError}</span>
          </div>
        )}

        {/* ── ENDED / REVEALED STATE ── */}
        {showEnded ? (
          <div className="flex flex-col items-center gap-3 py-8 border-t border-white/10">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
            <p className="text-gray-400 font-light italic tracking-wide text-sm">
              {isRevealed
                ? "You have revealed your identities."
                : "This scene has faded to black."}
            </p>
          </div>
        ) : (
          <>
            {/* ── LOCKED STATE ── */}
            {isLocked ? (
              <>
                <div className="flex items-end gap-2">
                  <textarea
                    disabled
                    rows={1}
                    maxLength={500}
                    placeholder="AI is typing..."
                    value=""
                    readOnly
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 transition-all duration-200 resize-none min-h-[48px] max-h-[160px] overflow-y-auto opacity-60 cursor-not-allowed"
                  />
                  <button
                    disabled
                    className="px-5 py-3 rounded-xl font-medium text-sm text-white transition-all duration-200 select-none opacity-30 cursor-not-allowed bg-gray-700"
                  >
                    Send
                  </button>
                </div>

                {/* ── TYPING INDICATOR ── */}
                <div className="mt-3 flex items-center justify-center">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                    <span
                      className="block w-2 h-2 rounded-full bg-purple-400"
                      style={{
                        animation: "typingBounce 1.4s infinite ease-in-out",
                        animationDelay: "0s",
                      }}
                    />
                    <span
                      className="block w-2 h-2 rounded-full bg-purple-400"
                      style={{
                        animation: "typingBounce 1.4s infinite ease-in-out",
                        animationDelay: "0.2s",
                      }}
                    />
                    <span
                      className="block w-2 h-2 rounded-full bg-purple-400"
                      style={{
                        animation: "typingBounce 1.4s infinite ease-in-out",
                        animationDelay: "0.4s",
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ── UNLOCKED STATE ── */}
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => {
                  setInput(e.target.value);
                  if (localError) setLocalError("");
                }}
                    onKeyDown={(e) => {
                      // Enter without Shift → send
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                      // Shift+Enter → default behaviour (newline)
                    }}
                    rows={1}
                    maxLength={500}
                    placeholder="Type your message..."
                    disabled={false}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none min-h-[48px] max-h-[160px] overflow-y-auto"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={isSendDisabled()}
                    className="px-5 py-3 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 active:scale-95 transform transition-all duration-200 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:from-gray-600 disabled:to-gray-700"
                  >
                    Send
                  </button>
                </div>

                {/* ── HELPER TEXT + CHARACTER COUNTER ── */}
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-gray-500 text-xs">
                    Press Enter to send &bull; Shift+Enter for new line
                  </p>
                  <span
                    className={["text-xs", getCharCountClass()].join(" ")}
                  >
                    {input.length}/500
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── TYPING BOUNCE KEYFRAMES ── */}
      <style jsx>{`
        @keyframes typingBounce {
          0%,
          80%,
          100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          40% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }
      `}</style>
    </div>
  );
}
