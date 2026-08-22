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
    <div className="flex flex-col gap-2 p-4 pb-24 overflow-y-auto h-full bg-gradient-to-b from-transparent via-black/20 to-black/40">
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-3">
        {/* ── EMPTY STATE ── */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <span
              className="block text-4xl opacity-20 mb-3"
              style={{
                animation: "breathGlow 3s infinite ease-in-out",
              }}
            >
              &#x1F52E;
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
                  <span className="text-brand/30 text-[10px]">&#9670;</span>
                  <span className="text-xs text-brand-lighter/80 uppercase tracking-wider font-semibold">
                    &#x1F3AD; {charName}
                  </span>
                  <span className="text-brand/30 text-[10px]">&#9670;</span>
                </div>

                {/* bubble */}
                <div className="max-w-[80%] px-4 py-3 bg-gradient-to-b from-brand-deep/30 to-black/20 border border-brand/20 rounded-xl italic font-light text-foreground text-sm leading-relaxed transition-all duration-300">
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
                    <span className="text-xs text-brand-lighter/70 font-medium">
                      You
                    </span>
                    <span className="block w-6 h-6 rounded-full bg-brand/40 border border-brand-light/30" />
                  </>
                ) : (
                  <>
                    <span className="block w-6 h-6 rounded-full bg-pink-500/40 border border-pink-400/30" />
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
                    ? "bg-gradient-to-br from-brand-dark/80 to-crimson-600/80 text-white rounded-2xl rounded-br-sm"
                    : "bg-white/10 text-foreground rounded-2xl rounded-bl-sm",
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
