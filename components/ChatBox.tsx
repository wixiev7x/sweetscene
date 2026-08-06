"use client";

import { useState, useRef, useEffect } from "react";
import {
  sanitizeAndScrub,
  containsBlockedTerm,
} from "@/lib/utils/safety";
import { MESSAGE_MAX_LENGTH } from "@/lib/config/constants";
import { TypingDots } from "@/components/ui";

type Participant = {
  id: string;
  alias: string;
  color: string; /* dot colour */
};

type ChatBoxProps = {
  isLocked: boolean;
  isEnded: boolean;
  isRevealed: boolean;
  errorMessage: string;
  onSend: (message: string) => void;
  /** Free messages left today — shown in the counter. Omit to hide. */
  freeMessagesLeft?: number;
  /** Participants other than the current user (only relevant for group). */
  participants?: Participant[];
};

/**
 * Chat footer — redesigned to the SweetScene design brief:
 * - Square-cornered (~10px radius) text input + send button
 * - Send button filled with --chat-bubble-user (crimson-pink)
 * - Reply-to popup listing participants (hidden when ≤2 total)
 * - Space Grotesk uppercase free-message counter below the input
 * - iOS-style spring animation on mount; reply popup slides up
 */
export default function ChatBox({
  isLocked,
  isEnded,
  isRevealed,
  errorMessage,
  onSend,
  freeMessagesLeft,
  participants = [],
}: ChatBoxProps) {
  const [input, setInput] = useState("");
  const [localError, setLocalError] = useState("");
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Participant | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Auto-resize textarea up to ~5 lines */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (containsBlockedTerm(trimmed)) {
      setLocalError("Message blocked.");
      setInput("");
      return;
    }
    onSend(sanitizeAndScrub(trimmed));
    setLocalError("");
    setInput("");
    setReplyTarget(null);
    setReplyOpen(false);
  }

  function isSendDisabled() {
    return input.trim().length === 0 || input.length > MESSAGE_MAX_LENGTH;
  }

  const showEnded = isEnded || isRevealed;
  const displayError = localError || errorMessage;
  /* Show reply popup only when there are multiple other participants */
  const showReplyToggle = participants.length > 1;

  if (showEnded) {
    return (
      <footer
        className="shrink-0 px-4 py-6 flex flex-col items-center gap-2"
        style={{ background: "var(--chat-bg)", borderTop: "1px solid var(--chat-divider)" }}
      >
        <p
          className="text-sm italic"
          style={{ color: "var(--chat-text-narrator)", fontFamily: "var(--font-fraunces)" }}
        >
          {isRevealed ? "You have revealed your identities." : "This scene has faded to black."}
        </p>
      </footer>
    );
  }

  return (
    <footer
      className="shrink-0 relative z-20"
      style={{ background: "var(--chat-bg)", borderTop: "1px solid var(--chat-divider)" }}
    >
      {/* ── REPLY-TO POPUP ── slides up from the footer */}
      {showReplyToggle && replyOpen && (
        <div
          className="reply-popup-in px-4 pt-3 pb-2"
          style={{ borderBottom: "1px solid var(--chat-divider)" }}
        >
          <p
            className="text-[10px] uppercase tracking-widest mb-2"
            style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-space)" }}
          >
            Reply to
          </p>
          <div className="flex flex-col gap-1">
            {participants.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setReplyTarget(replyTarget?.id === p.id ? null : p);
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left"
                style={{
                  background:
                    replyTarget?.id === p.id
                      ? "rgba(201,54,95,0.15)"
                      : "transparent",
                  border:
                    replyTarget?.id === p.id
                      ? "1px solid rgba(201,54,95,0.35)"
                      : "1px solid transparent",
                }}
              >
                <span
                  className="block w-2 h-2 rounded-full shrink-0"
                  style={{ background: p.color }}
                />
                <span
                  className="text-sm"
                  style={{
                    color: "var(--chat-text-primary)",
                    fontFamily: "var(--font-space)",
                  }}
                >
                  {p.alias}
                </span>
                {replyTarget?.id === p.id && (
                  <span
                    className="ml-auto text-[10px] uppercase tracking-widest"
                    style={{ color: "var(--chat-bubble-user)", fontFamily: "var(--font-space)" }}
                  >
                    Selected
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pt-3 pb-4">
        {/* ── ERROR BANNER ── */}
        {displayError && (
          <div
            className="mb-2 text-xs px-3 py-2 rounded-lg"
            style={{
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.25)",
              color: "#f87171",
              fontFamily: "var(--font-manrope)",
            }}
          >
            {displayError}
          </div>
        )}

        {/* ── REPLY TARGET CHIP ── */}
        {replyTarget && (
          <div
            className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-md w-fit"
            style={{
              background: "rgba(201,54,95,0.12)",
              border: "1px solid rgba(201,54,95,0.25)",
            }}
          >
            <span
              className="block w-1.5 h-1.5 rounded-full"
              style={{ background: replyTarget.color }}
            />
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: "var(--chat-text-primary)", fontFamily: "var(--font-space)" }}
            >
              Replying to {replyTarget.alias}
            </span>
            <button
              type="button"
              onClick={() => setReplyTarget(null)}
              className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Clear reply target"
              style={{ color: "var(--chat-text-primary)" }}
            >
              ×
            </button>
          </div>
        )}

        {/* ── INPUT ROW ── */}
        <div className="flex items-end gap-2">
          {/* Reply toggle button */}
          {showReplyToggle && (
            <button
              type="button"
              aria-label="Toggle reply selector"
              onClick={() => setReplyOpen((v) => !v)}
              className="shrink-0 w-11 h-11 flex items-center justify-center transition-colors rounded-[10px]"
              style={{
                background: replyOpen
                  ? "rgba(201,54,95,0.18)"
                  : "rgba(255,255,255,0.05)",
                border: `1px solid ${replyOpen ? "rgba(201,54,95,0.35)" : "rgba(255,255,255,0.08)"}`,
                color: replyOpen ? "var(--chat-bubble-user)" : "var(--chat-text-muted)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M2 5h9a3 3 0 010 6H7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4.5 8L2 5l2.5-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (localError) setLocalError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (!isSendDisabled() && !isLocked) handleSend();
              }
            }}
            disabled={isLocked}
            placeholder={isLocked ? "Waiting for response..." : "Say something..."}
            maxLength={MESSAGE_MAX_LENGTH}
            rows={1}
            className="flex-1 resize-none min-h-[44px] max-h-[120px] overflow-y-auto px-4 py-[10px] text-sm leading-snug outline-none transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "10px",
              color: "var(--chat-text-primary)",
              fontFamily: "var(--font-manrope)",
              caretColor: "var(--chat-bubble-user)",
            }}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={isSendDisabled() || isLocked}
            aria-label="Send message"
            className="shrink-0 w-11 h-11 flex items-center justify-center transition-all active:scale-90"
            style={{
              borderRadius: "10px",
              background: isSendDisabled() || isLocked
                ? "rgba(201,54,95,0.25)"
                : "var(--chat-bubble-user)",
              opacity: isSendDisabled() || isLocked ? 0.5 : 1,
              cursor: isSendDisabled() || isLocked ? "not-allowed" : "pointer",
            }}
          >
            {isLocked ? (
              <TypingDots />
            ) : (
              /* Up-arrow icon */
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M9 15V3M9 3L4 8M9 3l5 5"
                  stroke="#f3e4e9"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>

        {/* ── COUNTER ROW ── */}
        <div className="flex items-center justify-between mt-2 px-0.5">
          {freeMessagesLeft !== undefined ? (
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-space)" }}
            >
              {freeMessagesLeft} free messages left today
            </span>
          ) : (
            <span />
          )}
          <span
            className={[
              "text-[10px]",
              input.length > 450
                ? input.length >= MESSAGE_MAX_LENGTH
                  ? "text-red-400"
                  : "text-amber-400"
                : "",
            ].join(" ")}
            style={
              input.length <= 450
                ? { color: "var(--chat-text-muted)", fontFamily: "var(--font-space)" }
                : { fontFamily: "var(--font-space)" }
            }
          >
            {input.length}/{MESSAGE_MAX_LENGTH}
          </span>
        </div>
      </div>
    </footer>
  );
}
