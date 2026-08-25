"use client";

import { useEffect, useState } from "react";

export function SearchingUI({
  startTime,
  kinkTags,
  onCancel,
}: {
  startTime: number;
  kinkTags: string[];
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
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="flex items-center justify-center gap-10 mb-8">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-brand/20">
            YOU
          </div>
        </div>

        <div className="flex items-center" style={{ width: 60 }}>
          <div
            className="h-0.5 w-full border-t-2 border-dashed border-brand"
            style={{ animation: "pulseSignal 1.5s ease-in-out infinite" }}
          />
        </div>

        <div className="relative">
          <div
            className="w-20 h-20 rounded-full bg-foreground/5 border-2 border-dashed border-foreground/20 flex items-center justify-center text-2xl font-bold text-foreground/30 backdrop-blur-sm"
            style={{ animation: "pulseGlow 2s ease-in-out infinite" }}
          >
            ???
          </div>
        </div>
      </div>

      <p className="text-lg font-semibold text-foreground mb-2">Finding your match for roleplay...</p>
      <p className="text-3xl font-bold text-brand font-mono tabular-nums mb-3">{formatTime(elapsed)}</p>

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
        @keyframes pulseSignal {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 45, 149, 0); }
          50% { box-shadow: 0 0 20px 4px rgba(255, 45, 149, 0.15); }
        }
      `}</style>
    </div>
  );
}
