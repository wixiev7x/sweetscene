"use client";

import { useReducer, useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import { SearchingUI } from "@/components/matchmake/SearchingUI";
import { SuggestedBots } from "@/components/matchmake/SuggestedBots";
import { MATCHMAKING_POLL_INTERVAL_MS, type MatchMode } from "@/lib/matchmaking";

type State = {
  phase: "idle" | "searching" | "matched" | "timeout" | "cancelled";
  queueId: string | null;
  startTime: number;
  matchedWith: string | null;
  matchId: string | null;
};

type Action =
  | { type: "START_SEARCH"; queueId: string }
  | { type: "MATCHED"; matchedWith: string; matchId: string }
  | { type: "TIMEOUT" }
  | { type: "CANCEL" }
  | { type: "RESET" };

const initialState: State = {
  phase: "idle",
  queueId: null,
  startTime: 0,
  matchedWith: null,
  matchId: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START_SEARCH":
      return { ...initialState, phase: "searching", queueId: action.queueId, startTime: Date.now() };
    case "MATCHED":
      return { ...state, phase: "matched", matchedWith: action.matchedWith, matchId: action.matchId };
    case "TIMEOUT":
      return { ...state, phase: "timeout" };
    case "CANCEL":
      return { ...initialState, phase: "cancelled" };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const KINK_TAGS = [
  "Romance", "Slow Burn", "Dominant", "Submissive", "Fantasy", "Sci-Fi",
  "Mystery", "Adventure", "Thriller", "Comedy", "Drama", "Slice of Life",
  "Historical", "Horror", "Action", "Crime", "War", "Western",
];

export default function MatchmakePage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [mode, setMode] = useState<MatchMode>("quick");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const startSearch = useCallback(async () => {
    const res = await fetch("/api/matchmake/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kink_tags: selectedTags, mode }),
    });
    const data = await res.json();
    if (data.id) {
      dispatch({ type: "START_SEARCH", queueId: data.id });
      pollRef.current = setInterval(async () => {
        const statusRes = await fetch(`/api/matchmake/status?id=${data.id}`);
        const statusData = await statusRes.json();
        if (statusData.status === "matched") {
          if (pollRef.current) clearInterval(pollRef.current);
          dispatch({ type: "MATCHED", matchedWith: statusData.matched_with_user_id, matchId: data.id });
        } else if (statusData.status === "timeout") {
          if (pollRef.current) clearInterval(pollRef.current);
          dispatch({ type: "TIMEOUT" });
        }
      }, MATCHMAKING_POLL_INTERVAL_MS);
    }
  }, [selectedTags, mode]);

  const cancelSearch = useCallback(async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (state.queueId) {
      await fetch("/api/matchmake/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: state.queueId }),
      });
    }
    dispatch({ type: "CANCEL" });
  }, [state.queueId]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 pb-14 md:pb-0">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Matchmake</h1>

        {state.phase === "idle" || state.phase === "cancelled" ? (
          <div className="flex flex-col items-center">
            <div className="inline-flex rounded-full bg-ios-secondary p-1 mb-6 w-full max-w-xs">
              {(["quick", "kink", "blind_date"] as MatchMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-sm rounded-full transition-all ${
                    mode === m ? "bg-white text-black font-medium" : "text-muted"
                  }`}
                >
                  {m === "quick" ? "Quick Match" : m === "kink" ? "By Tag" : "Blind Date"}
                </button>
              ))}
            </div>

            {mode === "kink" && (
              <div className="w-full mb-6">
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
                  {KINK_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all ios-press ${
                        selectedTags.includes(tag)
                          ? "bg-white text-black border-white"
                          : "bg-transparent text-muted border-white/15 hover:border-white/30"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={startSearch}
              className="w-full max-w-xs h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-white text-base font-semibold ios-press shadow-lg shadow-brand/20"
            >
              Find My Match
            </button>

            <p className="text-xs text-muted text-center mt-4 max-w-xs leading-relaxed">
              Anonymous matchmaking. No names, no faces.<br />
              Reveal only when both sides agree.
            </p>
            <Link href="/how" className="text-xs text-brand/60 hover:text-brand mt-2">
              How it works
            </Link>
          </div>
        ) : null}

        {state.phase === "searching" && (
          <>
            <SearchingUI startTime={state.startTime} kinkTags={selectedTags} onCancel={cancelSearch} />
            <div className="border-t border-white/5 pt-4">
              <SuggestedBots kinkTags={selectedTags} />
            </div>
          </>
        )}

        {state.phase === "matched" && (
          <div className="flex flex-col items-center py-12">
            <div className="flex items-center justify-center gap-10 mb-8">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-brand/20">
                YOU
              </div>
              <div className="h-0.5 w-16 bg-brand" />
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-dark to-crimson-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-brand/20">
                ???
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground mb-2">Match found!</p>
            <p className="text-sm text-muted mb-8">Your anonymous partner is ready.</p>
            <Link
              href={`/chat/${state.matchId}`}
              className="w-full max-w-xs h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-white text-base font-semibold flex items-center justify-center ios-press shadow-lg shadow-brand/20 mb-3"
            >
              Start Roleplay
            </Link>
            <button
              onClick={() => dispatch({ type: "RESET" })}
              className="text-sm text-muted hover:text-foreground transition-colors ios-press"
            >
              Skip &amp; Find Another
            </button>
          </div>
        )}

        {state.phase === "timeout" && (
          <div className="flex flex-col items-center py-12">
            <p className="text-lg font-semibold text-foreground mb-2">No match found right now</p>
            <p className="text-sm text-muted mb-8">Try again or chat with a suggested bot.</p>
            <button
              onClick={() => dispatch({ type: "RESET" })}
              className="w-full max-w-xs h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-white text-base font-semibold ios-press shadow-lg shadow-brand/20 mb-3"
            >
              Try Again
            </button>
            <Link
              href="/explore"
              className="w-full max-w-xs h-[44px] rounded-full border border-white/15 text-muted hover:text-foreground hover:border-white/30 transition-all flex items-center justify-center text-sm ios-press"
            >
              Browse Bots
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
