"use client";

import { useEffect, useRef } from "react";

type ChatMessage = {
  id: string;
  sender_type: "human" | "ai";
  sender_id: string | null;
  character_id: string | null;
  character_name?: string | null;
  content: string;
  created_at: string;
  is_mine?: boolean;
};

type MessageListProps = {
  messages: ChatMessage[];
  currentUserId: string;
};

/**
 * Renders a chat message list with distinct styling for human ("mine"
 * vs "stranger") and AI narrator messages. Auto-scrolls to the latest
 * message on update and shows an empty-state placeholder when no
 * messages exist yet.
 */
export default function MessageList({
  messages,
  currentUserId,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /**
   * Formats an ISO timestamp to a short locale time string (HH:mm).
   */
  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Determines whether the given message was sent by the current user.
   */
  function isMine(msg: ChatMessage): boolean {
    if (msg.is_mine === true) return true;
    return msg.sender_id === currentUserId;
  }

  return (
    <div className="flex flex-col gap-2 p-4 pb-24 overflow-y-auto h-full bg-gradient-to-b from-transparent via-background/20 to-background/40">
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-3">
        {/* ── EMPTY STATE ── */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <span
              className="block mb-3"
              style={{
                animation: "breathGlow 3s infinite ease-in-out",
              }}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <ellipse cx="20" cy="14" rx="9" ry="10" fill="var(--accent-candle)" opacity="0.25" />
                <path d="M20 7c2.5 3 4 4.5 4 7a4 4 0 1 1-8 0c0-2.5 1.5-4 4-7z" fill="var(--accent-candle)" />
                <rect x="16" y="18" width="8" height="2" rx="1" fill="var(--accent-candle-deep)" />
                <rect x="14" y="20" width="12" height="13" rx="2.5" fill="var(--surface-300)" />
                <rect x="14" y="20" width="12" height="13" rx="2.5" fill="url(#candleShade)" />
                <defs>
                  <linearGradient id="candleShade" x1="14" y1="20" x2="26" y2="33" gradientUnits="userSpaceOnUse">
                    <stop stopColor="var(--accent-candle)" stopOpacity="0.15" />
                    <stop offset="1" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            <p className="text-muted text-sm italic">
              The scene is about to begin...
            </p>
          </div>
        )}

        {/* ── MESSAGE LIST ── */}
        {messages.map((msg) => {
          const mine = isMine(msg);

          // --- AI MESSAGE ---
          if (msg.sender_type === "ai") {
            const charName = msg.character_name || "Director";

            return (
              <div key={msg.id} className="flex flex-col items-center w-full my-3">
                {/* character label */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-accent-candle/40 text-[10px]">&#9670;</span>
                  <span className="text-xs text-accent-candle uppercase tracking-wider font-semibold">
                    &#x1F3AD; {charName}
                  </span>
                  <span className="text-accent-candle/40 text-[10px]">&#9670;</span>
                </div>

                {/* bubble */}
                <div className="max-w-[80%] px-4 py-3 bg-accent-candle/10 border border-accent-candle/25 rounded-xl italic font-light text-foreground text-sm leading-relaxed transition-all duration-300">
                  {msg.content}
                </div>

                {/* timestamp */}
                <span className="mt-1 text-[10px] text-muted-faint">
                  {formatTime(msg.created_at)}
                </span>
              </div>
            );
          }

          // --- HUMAN MESSAGE ---
          const otherName = msg.character_name || "Stranger";

          return (
            <div
              key={msg.id}
              className={[
                "flex flex-col w-full transition-all duration-300",
                mine ? "items-end" : "items-start",
              ].join(" ")}
            >
              {/* sender label */}
              <div
                className={[
                  "flex items-center gap-1.5 mb-1",
                  mine ? "flex-row-reverse" : "flex-row",
                ].join(" ")}
              >
                {mine ? (
                  <>
                    <span className="text-xs text-accent-candle font-medium">
                      You
                    </span>
                    <span className="block w-6 h-6 rounded-full bg-accent-candle/30 border border-accent-candle/50" />
                  </>
                ) : (
                  <>
                    <span className="block w-6 h-6 rounded-full bg-accent-rose/30 border border-accent-rose/50" />
                    <span className="text-xs text-muted-strong font-medium">
                      {otherName}
                    </span>
                  </>
                )}
              </div>

              {/* bubble */}
              <div
                className={[
                  "max-w-[75%] px-4 py-3 text-sm leading-relaxed transition-all duration-300",
                  mine
                    ? "bg-accent-rose/20 border border-accent-rose/30 text-foreground rounded-2xl rounded-br-sm"
                    : "bg-surface-raised border border-line text-foreground rounded-2xl rounded-bl-sm",
                ].join(" ")}
              >
                {msg.content}
              </div>

              {/* timestamp */}
              <span
                className={[
                  "mt-1 text-[10px] text-muted",
                  mine ? "text-right" : "text-left",
                ].join(" ")}
              >
                {formatTime(msg.created_at)}
              </span>
            </div>
          );
        })}

        {/* ── AUTO-SCROLL SENTINEL ── */}
        <div ref={bottomRef} />
      </div>

      {/* ── KEYFRAMES ── */}
      <style jsx>{`
        @keyframes breathGlow {
          0%,
          100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}
