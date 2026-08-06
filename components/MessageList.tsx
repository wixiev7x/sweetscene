"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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

type ContextMenuState = {
  msgId: string;
  x: number;
  y: number;
  isMine: boolean;
  isAI: boolean;
};

type MessageListProps = {
  messages: ChatMessage[];
  currentUserId: string;
};

/**
 * Chat message list — redesigned to the SweetScene design brief:
 * - Narrator lines: centered, italic Fraunces, --chat-text-narrator
 * - Other bubble:   left, Fraunces, --chat-bubble-other, sharp bottom-left
 * - My bubble:      right, Manrope, --chat-bubble-user, sharp bottom-right
 * - Entry animations: spring slide-in from the relevant side
 * - Long-press / right-click context menu per message
 */
export default function MessageList({
  messages,
  currentUserId,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [ctx, setCtx] = useState<ContextMenuState | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* close context menu on outside click */
  useEffect(() => {
    if (!ctx) return;
    const handler = () => setCtx(null);
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }, [ctx]);

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function isMine(msg: ChatMessage): boolean {
    if (msg.is_mine === true) return true;
    return msg.sender_id === currentUserId;
  }

  /* ── Long-press handler for mobile ── */
  const startPress = useCallback(
    (e: React.PointerEvent, msg: ChatMessage, mine: boolean) => {
      if (e.button !== 0 && e.pointerType !== "touch") return;
      pressTimer.current = setTimeout(() => {
        setCtx({
          msgId: msg.id,
          x: e.clientX,
          y: e.clientY,
          isMine: mine,
          isAI: msg.sender_type === "ai",
        });
      }, 500);
    },
    []
  );

  const cancelPress = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const onContextMenu = useCallback(
    (e: React.MouseEvent, msg: ChatMessage, mine: boolean) => {
      e.preventDefault();
      setCtx({
        msgId: msg.id,
        x: e.clientX,
        y: e.clientY,
        isMine: mine,
        isAI: msg.sender_type === "ai",
      });
    },
    []
  );

  return (
    <div
      className="flex flex-col h-full overflow-y-auto overscroll-contain"
      style={{ background: "var(--chat-bg)" }}
    >
      <div className="flex flex-col gap-1 px-4 pt-4 pb-32 max-w-lg mx-auto w-full">

        {/* ── EMPTY STATE ── */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div
              className="w-10 h-10 rounded-full"
              style={{
                background: "radial-gradient(circle, #c9365f44 0%, transparent 70%)",
                animation: "breathGlow 3s infinite ease-in-out",
              }}
            />
            <p
              className="text-sm italic text-center leading-relaxed"
              style={{ color: "var(--chat-text-narrator)", fontFamily: "var(--font-fraunces)" }}
            >
              The scene is about to begin...
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const mine = isMine(msg);

          /* ── NARRATOR / AI line ── */
          if (msg.sender_type === "ai") {
            const charName = msg.character_name || "Director";
            return (
              <div
                key={msg.id}
                className="msg-in-center flex flex-col items-center w-full my-4"
                style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}
              >
                {/* divider label */}
                <div className="flex items-center gap-3 w-full mb-2">
                  <div className="flex-1 h-px" style={{ background: "var(--chat-divider)" }} />
                  <span
                    className="text-[10px] uppercase tracking-widest shrink-0"
                    style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-space)" }}
                  >
                    {charName}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "var(--chat-divider)" }} />
                </div>

                {/* narrator text — no bubble, just centered italic */}
                <p
                  className="text-sm italic leading-relaxed text-center max-w-[85%]"
                  style={{ color: "var(--chat-text-narrator)", fontFamily: "var(--font-fraunces)" }}
                  onPointerDown={(e) => startPress(e, msg, false)}
                  onPointerUp={cancelPress}
                  onPointerCancel={cancelPress}
                  onContextMenu={(e) => onContextMenu(e, msg, false)}
                >
                  {msg.content}
                </p>

                <span
                  className="mt-1.5 text-[10px]"
                  style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-space)" }}
                >
                  {formatTime(msg.created_at)}
                </span>
              </div>
            );
          }

          /* ── HUMAN message ── */
          const otherName = (msg.character_name || "Stranger").toUpperCase();

          return (
            <div
              key={msg.id}
              className={[
                "flex flex-col w-full",
                mine ? "items-end msg-in-right" : "items-start msg-in-left",
              ].join(" ")}
              style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}
            >
              {/* alias label above bubble — only for other person */}
              {!mine && (
                <span
                  className="text-[10px] uppercase tracking-widest mb-1 px-1"
                  style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-space)" }}
                >
                  {otherName}
                </span>
              )}

              {/* bubble */}
              <div
                className={[
                  "relative max-w-[78%] px-4 py-3 text-sm leading-relaxed select-none",
                  /* corners: shared base then side-specific sharp corner */
                  mine
                    ? "rounded-2xl rounded-br-[4px]"
                    : "rounded-2xl rounded-bl-[4px]",
                ].join(" ")}
                style={
                  mine
                    ? {
                        background: "var(--chat-bubble-user)",
                        color: "#f3e4e9",
                        fontFamily: "var(--font-manrope)",
                        boxShadow: "0 2px 16px rgba(201,54,95,0.25)",
                      }
                    : {
                        background: "var(--chat-bubble-other)",
                        color: "var(--chat-text-primary)",
                        fontFamily: "var(--font-fraunces)",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                        border: "1px solid rgba(209,71,122,0.12)",
                      }
                }
                onPointerDown={(e) => startPress(e, msg, mine)}
                onPointerUp={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => onContextMenu(e, msg, mine)}
              >
                {msg.content}
              </div>

              {/* timestamp */}
              <span
                className={["mt-1 text-[10px]", mine ? "pr-1" : "pl-1"].join(" ")}
                style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-space)" }}
              >
                {formatTime(msg.created_at)}
              </span>
            </div>
          );
        })}

        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* ── CONTEXT MENU ── */}
      {ctx && (
        <div
          className="ctx-menu-in fixed z-50 min-w-[160px] rounded-xl overflow-hidden shadow-2xl"
          style={{
            top: Math.min(ctx.y, window.innerHeight - 200),
            left: Math.min(ctx.x, window.innerWidth - 180),
            background: "#1e1015",
            border: "1px solid rgba(209,71,122,0.2)",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {ctx.isMine && (
            <button
              className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors"
              style={{ color: "var(--chat-text-primary)", fontFamily: "var(--font-manrope)" }}
              onClick={() => setCtx(null)}
            >
              Edit
            </button>
          )}
          <button
            className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors"
            style={{ color: "var(--chat-text-primary)", fontFamily: "var(--font-manrope)" }}
            onClick={() => setCtx(null)}
          >
            Hide from my view
          </button>
          {ctx.isAI && (
            <button
              className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors"
              style={{ color: "var(--chat-text-primary)", fontFamily: "var(--font-manrope)" }}
              onClick={() => setCtx(null)}
            >
              Regenerate
            </button>
          )}
          <button
            className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors border-t"
            style={{
              color: "#f87171",
              fontFamily: "var(--font-manrope)",
              borderColor: "rgba(209,71,122,0.12)",
            }}
            onClick={() => setCtx(null)}
          >
            Report message
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes breathGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
