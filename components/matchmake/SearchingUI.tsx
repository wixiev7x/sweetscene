"use client";

import { useEffect, useState } from "react";

export function SearchingUI({
  startTime,
  kinkTags,
  queuePosition,
  onCancel,
}: {
  startTime: number;
  kinkTags: string[];
  queuePosition: number | null;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="flex items-center justify-center gap-6 mb-6 relative">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-brand/20" style={{ animation: "callRing 2s ease-out infinite" }} />
          <div className="absolute inset-0 rounded-full bg-brand/10" style={{ animation: "callRing 2s ease-out 0.5s infinite" }} />
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-brand/30 relative z-10">
            YOU
          </div>
        </div>

        <div className="relative flex items-center justify-center" style={{ width: 80, height: 40 }}>
          <div className="absolute h-0.5 w-full bg-gradient-to-r from-brand/40 via-brand to-brand/40" style={{ animation: "callPulse 1.5s ease-in-out infinite" }} />
          <div className="absolute w-2 h-2 rounded-full bg-brand" style={{ animation: "callDot 1.5s linear infinite", left: 0 }} />
          <div className="absolute w-2 h-2 rounded-full bg-brand" style={{ animation: "callDot 1.5s linear 0.5s infinite", left: 0 }} />
        </div>

        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-foreground/5" style={{ animation: "callRing 2s ease-out 0.3s infinite" }} />
          <div className="absolute inset-0 rounded-full bg-foreground/3" style={{ animation: "callRing 2s ease-out 0.8s infinite" }} />
          <div className="w-20 h-20 rounded-full bg-foreground/5 border-2 border-dashed border-foreground/20 flex items-center justify-center text-sm font-bold text-foreground/30 relative z-10">
            ???
          </div>
        </div>
      </div>

      <p className="text-lg font-semibold text-foreground mb-1">Calling...</p>
      <p className="text-sm text-muted mb-3">Finding your match for roleplay</p>
      <p className="text-2xl font-bold text-brand font-mono tabular-nums mb-2">{formatTime(elapsed)}</p>

      {queuePosition != null && queuePosition > 0 && (
        <p className="text-xs text-muted mb-4">
          {queuePosition === 1 ? "You're next in queue" : `Position in queue: #${queuePosition}`}
        </p>
      )}

      {kinkTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center max-w-xs mb-6">
          {kinkTags.map((tag) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
              {tag}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={onCancel}
        className="text-sm text-muted hover:text-foreground transition-colors ios-press"
      >
        Cancel search
      </button>

      <style jsx>{`
        @keyframes callRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes callPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes callDot {
          0% { transform: translateX(0); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(76px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
