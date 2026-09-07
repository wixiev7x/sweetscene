"use client";

import { useReducer, useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { SuggestedBots } from "@/components/matchmake/SuggestedBots";
import { playSound } from "@/lib/utils/sound";
import { MATCHMAKING_POLL_INTERVAL_MS, type MatchMode } from "@/lib/matchmaking";

type State = {
  phase: "idle" | "searching" | "matched" | "timeout" | "cancelled";
  queueId: string | null;
  startTime: number;
  matchedWith: string | null;
  matchId: string | null;
  queuePosition: number | null;
};

type Action =
  | { type: "START_SEARCH"; queueId: string }
  | { type: "MATCHED"; matchedWith: string; matchId: string }
  | { type: "TIMEOUT" }
  | { type: "CANCEL" }
  | { type: "RESET" }
  | { type: "UPDATE_POSITION"; position: number | null };

const initialState: State = {
  phase: "idle",
  queueId: null,
  startTime: 0,
  matchedWith: null,
  matchId: null,
  queuePosition: null,
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
    case "UPDATE_POSITION":
      return { ...state, queuePosition: action.position };
    default:
      return state;
  }
}

const VIBE_TAGS = [
  "Romance", "Slow Burn", "Dominant", "Submissive", "Fantasy", "Sci-Fi",
  "Mystery", "Adventure", "Thriller", "Comedy", "Drama", "Slice of Life",
  "Historical", "Horror", "Action", "Crime", "War", "Western",
];

const MODE_CARDS: {
  key: MatchMode | "friend";
  name: string;
  promise: string;
  note: string;
  icon: string;
}[] = [
  {
    key: "quick",
    name: "Quick Match",
    promise: "Straight into a scene with whoever is looking right now.",
    note: "no tags needed",
    icon: "M13 2L3 14h7l-1 8 10-12h-7l1-8z",
  },
  {
    key: "kink",
    name: "By Vibe",
    promise: "Matched on the tags you pick — romance, mystery, anything.",
    note: "up to 5 vibes",
    icon: "M12 21s-7-4.6-9.3-8.4C1 9.6 2.4 6 5.7 6c2 0 3.2 1.1 4.3 2.6C11.1 7.1 12.3 6 14.3 6c3.3 0 4.7 3.6 3 6.6C19 16.4 12 21 12 21z",
  },
  {
    key: "blind_date",
    name: "Blind Date",
    promise: "Nothing revealed — not even vibes — until you both unmask.",
    note: "full anonymity",
    icon: "M12 3a9 9 0 100 18 9 9 0 000-18zM4.5 12c3.6-3 9.4-3 13 0-3.6 3-9.4 3-13 0z",
  },
  {
    key: "friend",
    name: "Play with Friend",
    promise: "Bring your own person and pick the scene together.",
    note: "username invite",
    icon: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
  },
];

const LOADER_STAGES = [
  "Lighting the candles…",
  "Reading the room…",
  "Finding your scene…",
];

interface BotCard {
  id: string;
  name: string;
  tagline: string | null;
  is_nsfw: boolean | null;
}

interface FriendUser {
  id: string;
  anonymous_username: string;
}

const SOLO_GUEST_LIMIT = 5;
const MAX_TAGS = 5;

function Silhouette({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden className="flex-shrink-0">
      <defs>
        <radialGradient id="sil-glow" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="var(--accent-candle)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent-candle)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill="url(#sil-glow)" />
      <circle cx="40" cy="32" r="13" fill="var(--surface-200)" />
      <path d="M18 72c2-16 10-24 22-24s20 8 22 24" fill="var(--surface-200)" />
    </svg>
  );
}

function Candle() {
  return (
    <svg width="72" height="96" viewBox="0 0 72 96" aria-hidden>
      <defs>
        <radialGradient id="flame-glow" cx="50%" cy="20%" r="60%">
          <stop offset="0%" stopColor="var(--accent-candle)" stopOpacity="0.8" />
          <stop offset="60%" stopColor="var(--accent-candle)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--accent-candle)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="36" cy="26" r="26" fill="url(#flame-glow)">
        <animate attributeName="r" values="24;28;24" dur="1.6s" repeatCount="indefinite" />
      </circle>
      <path d="M36 6c5 7 8 10 8 16a8 8 0 11-16 0c0-6 3-9 8-16z" fill="var(--accent-candle)">
        <animate attributeName="opacity" values="1;0.75;1" dur="0.9s" repeatCount="indefinite" />
      </path>
      <rect x="30" y="30" width="12" height="6" rx="2" fill="var(--accent-candle-deep)" />
      <rect x="24" y="36" width="24" height="52" rx="6" fill="var(--surface-300)" />
      <rect x="24" y="36" width="8" height="52" rx="4" fill="var(--surface-200)" opacity="0.6" />
    </svg>
  );
}

export default function MatchmakePage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [mode, setMode] = useState<MatchMode | "friend" | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [loaderStage, setLoaderStage] = useState(0);
  const [sharedTags, setSharedTags] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [friendUsername, setFriendUsername] = useState("");
  const [friendResults, setFriendResults] = useState<FriendUser[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendUser | null>(null);
  const [bots, setBots] = useState<BotCard[]>([]);
  const [selectedBot, setSelectedBot] = useState<string | null>(null);
  const [friendError, setFriendError] = useState("");
  const [friendLoading, setFriendLoading] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= MAX_TAGS) return prev;
      return [...prev, tag];
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setIsLoggedIn(!!user);
        const { data } = await supabase.from("bots").select("id, name, tagline, is_nsfw").limit(20);
        if (data) setBots(data as BotCard[]);
      } catch {
        setIsLoggedIn(false);
      }
    })();
  }, []);

  const requireAuth = () => {
    if (isLoggedIn === false) {
      router.push("/signup?next=/matchmake");
      return false;
    }
    return true;
  };

  const fetchSharedTags = useCallback(async (matchId: string) => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("matches")
        .select("scenario_tags")
        .eq("id", matchId)
        .single();
      if (data?.scenario_tags) setSharedTags(data.scenario_tags as string[]);
    } catch {
    }
  }, []);

  const startSearch = useCallback(async () => {
    if (!requireAuth() || !mode) return;
    setSearching(true);
    try {
      const res = await fetch("/api/matchmake/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kink_tags: selectedTags, mode }),
      });
      if (res.status === 401) {
        router.push("/signup?next=/matchmake");
        return;
      }
      const data = await res.json();
      if (data.id) {
        setLoaderStage(0);
        stageRef.current = setInterval(() => {
          setLoaderStage((s) => Math.min(s + 1, LOADER_STAGES.length - 1));
        }, 1500);
        dispatch({ type: "START_SEARCH", queueId: data.id });
        pollRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/matchmake/status?id=${data.id}`);
            const statusData = await statusRes.json();
            if (statusData.status === "matched") {
              if (pollRef.current) clearInterval(pollRef.current);
              if (stageRef.current) clearInterval(stageRef.current);
              const matchId = statusData.match_id || data.id;
              dispatch({
                type: "MATCHED",
                matchedWith: statusData.matched_with_user_id || "unknown",
                matchId,
              });
              playSound("matchFound");
              fetchSharedTags(matchId);
            } else if (statusData.status === "timeout") {
              if (pollRef.current) clearInterval(pollRef.current);
              if (stageRef.current) clearInterval(stageRef.current);
              dispatch({ type: "TIMEOUT" });
            } else if (statusData.queue_position != null) {
              dispatch({ type: "UPDATE_POSITION", position: statusData.queue_position });
            }
          } catch {
          }
        }, MATCHMAKING_POLL_INTERVAL_MS);
      } else {
        toast.error("Couldn't reach the scene — try again");
      }
    } catch {
      toast.error("Couldn't reach the scene — try again");
    } finally {
      setSearching(false);
    }
  }, [selectedTags, mode, isLoggedIn, router, fetchSharedTags]);

  const cancelSearch = useCallback(async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (stageRef.current) clearInterval(stageRef.current);
    if (state.queueId) {
      try {
        await fetch("/api/matchmake/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: state.queueId }),
        });
      } catch {
      }
    }
    dispatch({ type: "CANCEL" });
  }, [state.queueId]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (stageRef.current) clearInterval(stageRef.current);
    };
  }, []);

  const searchFriends = async () => {
    if (!requireAuth()) return;
    setFriendLoading(true);
    setFriendError("");
    setFriendResults([]);
    setSelectedFriend(null);
    try {
      const res = await fetch("/api/matchmake/friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendUsername }),
      });
      if (res.status === 401) {
        router.push("/signup?next=/matchmake");
        return;
      }
      const data = await res.json();
      if (data.users) {
        setFriendResults(data.users);
      } else {
        setFriendError(data.error || "No users found");
      }
    } catch {
      setFriendError("Search failed");
    } finally {
      setFriendLoading(false);
    }
  };

  const createRoom = async () => {
    if (!selectedFriend) return;
    setFriendLoading(true);
    setFriendError("");
    try {
      const res = await fetch("/api/matchmake/friend", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: selectedFriend.id, botId: selectedBot }),
      });
      const data = await res.json();
      if (data.matchId) {
        setCreatedRoom(data.matchId);
      } else {
        setFriendError(data.error || "Failed to create room");
      }
    } catch {
      setFriendError("Failed to create room");
    } finally {
      setFriendLoading(false);
    }
  };

  const roomNumber = state.matchId ? state.matchId.substring(0, 6).toUpperCase() : "XXXXXX";
  const friendRoomNumber = createdRoom ? createdRoom.substring(0, 6).toUpperCase() : "";

  const overlap = sharedTags.filter((t) => selectedTags.includes(t));
  const compatibility =
    selectedTags.length > 0 && overlap.length > 0
      ? Math.round((overlap.length / selectedTags.length) * 100)
      : null;
  const whyBullets =
    mode === "blind_date"
      ? [
          "Full blind — no vibes, no info, nothing",
          "The reveal only happens if you both choose it",
          "One scene, thirty minutes, zero expectations",
        ]
      : overlap.length > 0
        ? overlap.slice(0, 3).map((t) => `You both picked ${t}`)
        : [
            "Both of you were looking for a scene right now",
            "Matched by the moment, not a checklist",
            "Identities stay hidden until you both unmask",
          ];

  const inputClass =
    "flex-1 px-4 py-2.5 rounded-[var(--radius-control)] bg-surface-sunken text-foreground text-sm border border-line focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-line-focus transition-colors";

  return (
    <main className="min-h-screen bg-background text-foreground px-4 sm:px-6 py-8 pb-14 md:pb-0">
      <div className="max-w-2xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-candle mb-2">
          Anonymous matchmaking
        </p>
        <h1 className="font-retro text-4xl md:text-5xl leading-tight mb-3">
          Four ways <span className="gradient-text">in.</span>
        </h1>
        <p className="text-muted text-sm mb-8">One person on the other side.</p>

        {state.phase === "idle" || state.phase === "cancelled" ? (
          <div className="flex flex-col">
            {!mode ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {MODE_CARDS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => {
                      setMode(m.key);
                      setCreatedRoom(null);
                      setFriendResults([]);
                      setSelectedFriend(null);
                      playSound("click");
                    }}
                    className="group text-left bg-surface border border-line rounded-[var(--radius-card)] p-5 ios-press hover:-translate-y-0.5 hover:border-line-strong focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none transition-all"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-10 h-10 rounded-full bg-accent-candle/10 flex items-center justify-center text-accent-candle group-hover:bg-accent-candle/15 transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d={m.icon} />
                        </svg>
                      </span>
                      <span className="text-base font-semibold text-foreground">{m.name}</span>
                    </div>
                    <p className="text-sm text-muted leading-relaxed mb-2">{m.promise}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-accent-candle/80">{m.note}</p>
                  </button>
                ))}
              </div>
            ) : mode === "friend" ? (
              <div className="space-y-4">
                <button
                  onClick={() => { setMode(null); setCreatedRoom(null); }}
                  className="text-xs font-mono uppercase tracking-wider text-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none rounded transition-colors"
                >
                  ← All modes
                </button>

                {!createdRoom ? (
                  isLoggedIn === false ? (
                    <div className="text-center py-8 bg-surface border border-line rounded-[var(--radius-card)]">
                      <p className="text-sm text-muted mb-4">You need an account to play with friends.</p>
                      <Link
                        href="/signup?next=/matchmake"
                        className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-brand to-brand-dark text-accent-foreground text-sm font-semibold ios-press focus-visible:ring-2 focus-visible:ring-line-focus"
                      >
                        Sign Up Free
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Search by username</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={friendUsername}
                            onChange={(e) => setFriendUsername(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && searchFriends()}
                            placeholder="Enter friend's username..."
                            className={inputClass}
                          />
                          <button
                            onClick={searchFriends}
                            disabled={friendLoading || friendUsername.trim().length < 2}
                            className="px-4 py-2.5 rounded-[var(--radius-control)] bg-surface-raised text-foreground text-sm font-medium ios-press disabled:opacity-50 hover:border-line-strong border border-line focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none transition-all"
                          >
                            {friendLoading ? "…" : "Search"}
                          </button>
                        </div>
                      </div>

                      {friendError && <p className="text-sm text-danger">{friendError}</p>}

                      {friendResults.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted font-mono uppercase tracking-wider">
                            Found {friendResults.length} user{friendResults.length > 1 ? "s" : ""}
                          </p>
                          {friendResults.map((f) => (
                            <button
                              key={f.id}
                              onClick={() => setSelectedFriend(f)}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-control)] border transition-all ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none ${
                                selectedFriend?.id === f.id
                                  ? "border-accent-candle/50 bg-accent-candle/10"
                                  : "border-line bg-surface hover:border-line-strong"
                              }`}
                            >
                              <div className="w-9 h-9 rounded-full bg-accent-candle/15 flex items-center justify-center text-sm font-bold text-accent-candle font-retro">
                                {f.anonymous_username.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-foreground">{f.anonymous_username}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedFriend && (
                        <div className="space-y-3 pt-2">
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">
                              Pick a character for the scene
                            </label>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto scrollbar-none">
                              {bots.map((bot) => (
                                <button
                                  key={bot.id}
                                  onClick={() => setSelectedBot(bot.id)}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-[var(--radius-control)] border transition-all ios-press text-left focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none ${
                                    selectedBot === bot.id
                                      ? "border-accent-candle/50 bg-accent-candle/10"
                                      : "border-line bg-surface hover:border-line-strong"
                                  }`}
                                >
                                  <div className="w-7 h-7 rounded bg-surface-raised flex items-center justify-center text-xs font-bold text-accent-candle/70 flex-shrink-0 font-retro">
                                    {bot.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-xs text-foreground truncate">{bot.name}</span>
                                </button>
                              ))}
                            </div>
                            <Link
                              href="/create"
                              className="text-xs text-accent-candle/70 hover:text-accent-candle mt-1.5 inline-block focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none rounded"
                            >
                              Or create a new character →
                            </Link>
                          </div>

                          <button
                            onClick={createRoom}
                            disabled={friendLoading}
                            className="w-full h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-accent-foreground text-sm font-semibold ios-press shadow-lg shadow-brand/20 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
                          >
                            {friendLoading ? "Creating…" : `Create Room with ${selectedFriend.anonymous_username}`}
                          </button>
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <div className="flex flex-col items-center py-10 bg-surface border border-line rounded-[var(--radius-card)]">
                    <p className="font-retro text-2xl mb-2">Room created!</p>
                    <p className="text-sm text-muted mb-1 font-mono">#{friendRoomNumber}</p>
                    <p className="text-xs text-muted mb-8 text-center max-w-xs">
                      Share this link with your friend to start the scene together.
                    </p>
                    <a
                      href={`/chat/${createdRoom}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full max-w-xs h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-accent-foreground text-base font-semibold flex items-center justify-center ios-press shadow-lg shadow-brand/20 mb-3 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
                    >
                      Open Room #{friendRoomNumber}
                    </a>
                    <button
                      onClick={() => {
                        setCreatedRoom(null);
                        setSelectedFriend(null);
                        setFriendResults([]);
                        setFriendUsername("");
                      }}
                      className="text-sm text-muted hover:text-foreground transition-colors ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none rounded"
                    >
                      Create Another Room
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <button
                  onClick={() => setMode(null)}
                  className="text-xs font-mono uppercase tracking-wider text-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none rounded transition-colors"
                >
                  ← All modes
                </button>

                {isLoggedIn === false && (
                  <div className="px-4 py-3 rounded-[var(--radius-control)] bg-accent-candle/5 border border-accent-candle/30 text-center">
                    <p className="text-sm text-foreground">Sign up to start matchmaking with real people</p>
                    <Link
                      href="/signup?next=/matchmake"
                      className="text-sm text-accent-candle font-medium hover:text-accent-candle-deep focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none rounded"
                    >
                      Create your identity →
                    </Link>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Pick your vibe{" "}
                    <span className="font-mono text-[10px] uppercase tracking-wider text-accent-candle/80">
                      up to {MAX_TAGS} · optional
                    </span>
                  </p>
                  <p className="text-xs text-muted mb-3">
                    {mode === "blind_date"
                      ? "Tags stay private on a blind date — pick them for the scene, not the reveal."
                      : "The matchmaker looks for someone who chose the same vibes."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {VIBE_TAGS.map((tag) => {
                      const selected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none ${
                            selected
                              ? "bg-accent-candle/15 text-accent-candle border-accent-candle/40"
                              : "bg-surface-sunken text-muted border-line hover:border-line-strong hover:text-foreground"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={startSearch}
                  disabled={searching}
                  className="w-full h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-accent-foreground text-base font-semibold ios-press shadow-lg shadow-brand/20 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
                >
                  {searching ? "Starting…" : "Find My Match"}
                </button>

                <div className="pt-6 border-t border-line">
                  <p className="text-sm font-medium text-foreground mb-1">Just want to chat solo?</p>
                  <p className="text-xs text-muted mb-3">
                    {isLoggedIn === false
                      ? `Try chatting with an AI character — first ${SOLO_GUEST_LIMIT} messages free, no signup needed.`
                      : "Browse and chat with AI characters created by the community."}
                  </p>
                  <Link
                    href="/explore"
                    className="inline-flex items-center gap-2 text-sm text-accent-candle font-medium hover:text-accent-candle-deep ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none rounded"
                  >
                    Browse Characters →
                  </Link>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-faint text-center mt-8 leading-relaxed">
              Anonymous matchmaking. No names, no faces. Reveal only when both sides agree.
            </p>
            <Link
              href="/how"
              className="block text-center text-xs text-accent-candle/60 hover:text-accent-candle mt-2 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none rounded w-fit mx-auto"
            >
              How it works
            </Link>
          </div>
        ) : null}

        {state.phase === "searching" && (
          <>
            <div className="flex flex-col items-center py-10 bg-surface border border-line rounded-[var(--radius-card)]">
              <Candle />
              <p className="font-retro text-lg mt-4 mb-1" aria-live="polite">
                {LOADER_STAGES[loaderStage]}
              </p>
              {state.queuePosition != null && (
                <p className="font-mono text-xs text-accent-candle/80 uppercase tracking-wider">
                  Position #{state.queuePosition} in the queue
                </p>
              )}
              <div className="flex gap-1.5 mt-6 mb-6">
                {LOADER_STAGES.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i <= loaderStage ? "w-8 bg-accent-candle" : "w-3 bg-surface-300"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={cancelSearch}
                className="text-sm text-muted hover:text-foreground border border-line rounded-full px-5 py-2 ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none transition-colors"
              >
                Cancel
              </button>
            </div>
            <div className="border-t border-line pt-4 mt-4">
              <SuggestedBots kinkTags={selectedTags} />
            </div>
          </>
        )}

        {state.phase === "matched" && (
          <div className="bg-surface border border-line rounded-[var(--radius-card)] p-6 sm:p-8 flex flex-col items-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-candle mb-4">
              Match found
            </p>
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-full bg-accent-candle/15 border border-accent-candle/30 flex items-center justify-center text-sm font-bold text-accent-candle font-retro">
                  YOU
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-faint">you</span>
              </div>
              <div className="h-0.5 w-12 bg-gradient-to-r from-accent-candle to-accent-rose" />
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-full bg-surface-raised border border-line overflow-hidden flex items-center justify-center">
                  <Silhouette size={64} />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-faint">
                  {mode === "blind_date" ? "blind date" : "anonymous"}
                </span>
              </div>
            </div>

            {compatibility != null && mode !== "blind_date" && (
              <div className="mb-4 text-center">
                <p className="font-retro text-3xl gradient-text">{compatibility}%</p>
                <p className="text-xs text-muted font-mono uppercase tracking-wider">vibe match</p>
              </div>
            )}

            {mode !== "blind_date" && sharedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center mb-4">
                {sharedTags.slice(0, 6).map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-line bg-surface-sunken text-muted font-mono"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {mode === "blind_date" && (
              <p className="text-sm text-muted text-center mb-4 max-w-xs leading-relaxed">
                Nothing is revealed on a blind date — not vibes, not names.
                The unmask only happens if you both choose it.
              </p>
            )}

            <div className="w-full max-w-sm mb-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-candle/80 mb-2 text-center">
                Why you matched
              </p>
              <ul className="space-y-1.5">
                {whyBullets.map((b) => (
                  <li key={b} className="text-sm text-muted flex items-start gap-2">
                    <span className="text-accent-candle mt-0.5">•</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-muted font-mono mb-6">Room #{roomNumber}</p>
            <a
              href={`/chat/${state.matchId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full max-w-xs h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-accent-foreground text-base font-semibold flex items-center justify-center ios-press shadow-lg shadow-brand/20 mb-3 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
            >
              Go to Room #{roomNumber}
            </a>
            <button
              onClick={() => {
                dispatch({ type: "RESET" });
                setSharedTags([]);
              }}
              className="text-sm text-muted hover:text-foreground transition-colors ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none rounded"
            >
              Skip &amp; Find Another
            </button>
          </div>
        )}

        {state.phase === "timeout" && (
          <div className="bg-surface border border-line rounded-[var(--radius-card)] p-8 flex flex-col items-center">
            <p className="font-retro text-xl mb-2">No one in your scene right now</p>
            <p className="text-sm text-muted mb-8 text-center max-w-xs">
              Try loosening your tags — or chat solo with a character while you wait.
            </p>
            <button
              onClick={() => {
                dispatch({ type: "RESET" });
                setSharedTags([]);
              }}
              className="w-full max-w-xs h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-accent-foreground text-base font-semibold ios-press shadow-lg shadow-brand/20 mb-3 focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
            >
              Find Again
            </button>
            <a
              href="/explore"
              className="w-full max-w-xs h-[44px] rounded-full border border-line text-muted hover:text-foreground hover:border-line-strong transition-all flex items-center justify-center text-sm ios-press focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:outline-none"
            >
              Go Solo
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
