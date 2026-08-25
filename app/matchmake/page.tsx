"use client";

import { useReducer, useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SearchingUI } from "@/components/matchmake/SearchingUI";
import { SuggestedBots } from "@/components/matchmake/SuggestedBots";
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

const KINK_TAGS = [
  "Romance", "Slow Burn", "Dominant", "Submissive", "Fantasy", "Sci-Fi",
  "Mystery", "Adventure", "Thriller", "Comedy", "Drama", "Slice of Life",
  "Historical", "Horror", "Action", "Crime", "War", "Western",
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

export default function MatchmakePage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [mode, setMode] = useState<MatchMode | "friend">("quick");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
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

  const startSearch = useCallback(async () => {
    if (!requireAuth()) return;
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
        dispatch({ type: "START_SEARCH", queueId: data.id });
        pollRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/matchmake/status?id=${data.id}`);
            const statusData = await statusRes.json();
            if (statusData.status === "matched") {
              if (pollRef.current) clearInterval(pollRef.current);
              dispatch({
                type: "MATCHED",
                matchedWith: statusData.matched_with_user_id || "unknown",
                matchId: statusData.match_id || data.id,
              });
            } else if (statusData.status === "timeout") {
              if (pollRef.current) clearInterval(pollRef.current);
              dispatch({ type: "TIMEOUT" });
            } else if (statusData.queue_position != null) {
              dispatch({ type: "UPDATE_POSITION", position: statusData.queue_position });
            }
          } catch {
          }
        }, MATCHMAKING_POLL_INTERVAL_MS);
      }
    } catch {
    } finally {
      setSearching(false);
    }
  }, [selectedTags, mode, isLoggedIn, router]);

  const cancelSearch = useCallback(async () => {
    if (pollRef.current) clearInterval(pollRef.current);
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

  return (
    <main className="min-h-screen bg-void-950 text-white px-4 sm:px-6 py-8 pb-14 md:pb-0">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Matchmake</h1>

        {state.phase === "idle" || state.phase === "cancelled" ? (
          <div className="flex flex-col items-center">
            <div className="inline-flex rounded-full bg-ios-secondary p-1 mb-6 w-full max-w-2xl overflow-x-auto scrollbar-none">
              {([
                { key: "quick", label: "Quick Match" },
                { key: "kink", label: "By Tag" },
                { key: "blind_date", label: "Blind Date" },
                { key: "friend", label: "Play with Friend" },
              ] as { key: MatchMode | "friend"; label: string }[]).map((m) => (
                <button
                  key={m.key}
                  onClick={() => { setMode(m.key); setCreatedRoom(null); setFriendResults([]); setSelectedFriend(null); }}
                  className={`flex-1 py-2 text-xs sm:text-sm rounded-full transition-all whitespace-nowrap px-3 ${
                    mode === m.key ? "bg-white text-black font-medium" : "text-muted"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {isLoggedIn === false && mode !== "friend" && (
              <div className="w-full max-w-md mb-4 px-4 py-3 rounded-xl bg-brand/10 border border-brand/20 text-center">
                <p className="text-sm text-foreground">
                  Sign up to start matchmaking with real people
                </p>
                <Link href="/signup?next=/matchmake" className="text-sm text-brand font-medium hover:text-brand-light">
                  Create your identity →
                </Link>
              </div>
            )}

            {isLoggedIn === false && mode === "friend" && (
              <div className="w-full max-w-md mb-4 px-4 py-3 rounded-xl bg-brand/10 border border-brand/20 text-center">
                <p className="text-sm text-foreground">
                  Sign up to play with friends
                </p>
                <Link href="/signup?next=/matchmake" className="text-sm text-brand font-medium hover:text-brand-light">
                  Create your identity →
                </Link>
              </div>
            )}

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

            {mode !== "friend" && (
              <>
                <button
                  onClick={startSearch}
                  disabled={searching}
                  className="w-full max-w-xs h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-white text-base font-semibold ios-press shadow-lg shadow-brand/20 disabled:opacity-50"
                >
                  {searching ? "Starting..." : "Find My Match"}
                </button>

                <div className="w-full max-w-md mt-8 pt-6 border-t border-white/5">
                  <p className="text-sm font-medium text-foreground mb-1">Just want to chat solo?</p>
                  <p className="text-xs text-muted mb-3">
                    {isLoggedIn === false
                      ? `Try chatting with an AI character — first ${SOLO_GUEST_LIMIT} messages free, no signup needed.`
                      : "Browse and chat with AI characters created by the community."}
                  </p>
                  <Link
                    href="/explore"
                    className="inline-flex items-center gap-2 text-sm text-brand font-medium hover:text-brand-light ios-press"
                  >
                    Browse Characters →
                  </Link>
                </div>

                <p className="text-xs text-muted text-center mt-6 max-w-xs leading-relaxed">
                  Anonymous matchmaking. No names, no faces.<br />
                  Reveal only when both sides agree.
                </p>
                <Link href="/how" className="text-xs text-brand/60 hover:text-brand mt-2">
                  How it works
                </Link>
              </>
            )}

            {mode === "friend" && !createdRoom && (
              <div className="w-full max-w-md space-y-4">
                {isLoggedIn === false ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted mb-4">You need an account to play with friends.</p>
                    <Link
                      href="/signup?next=/matchmake"
                      className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-brand to-brand-dark text-white text-sm font-semibold ios-press"
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
                          className="flex-1 px-4 py-2.5 rounded-xl bg-ios-secondary text-white text-sm border border-white/10 focus:border-brand/50 focus:outline-none transition-colors"
                        />
                        <button
                          onClick={searchFriends}
                          disabled={friendLoading || friendUsername.trim().length < 2}
                          className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-medium ios-press disabled:opacity-50"
                        >
                          {friendLoading ? "..." : "Search"}
                        </button>
                      </div>
                    </div>

                    {friendError && <p className="text-sm text-danger">{friendError}</p>}

                    {friendResults.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted">Found {friendResults.length} user(s):</p>
                        {friendResults.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => setSelectedFriend(f)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ios-press ${
                              selectedFriend?.id === f.id
                                ? "border-brand bg-brand/10"
                                : "border-white/10 bg-ios-secondary hover:border-white/20"
                            }`}
                          >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand/30 to-brand-dark/30 flex items-center justify-center text-sm font-bold text-brand">
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
                          <label className="text-sm font-medium text-foreground mb-1.5 block">Pick a character for the scene</label>
                          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto scrollbar-none">
                            {bots.map((bot) => (
                              <button
                                key={bot.id}
                                onClick={() => setSelectedBot(bot.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ios-press text-left ${
                                  selectedBot === bot.id
                                    ? "border-brand bg-brand/10"
                                    : "border-white/10 bg-ios-secondary hover:border-white/20"
                                }`}
                              >
                                <div className="w-7 h-7 rounded bg-gradient-to-br from-foreground/10 to-foreground/5 flex items-center justify-center text-xs font-bold text-foreground/30 flex-shrink-0">
                                  {bot.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs text-foreground truncate">{bot.name}</span>
                              </button>
                            ))}
                          </div>
                          <Link href="/create" className="text-xs text-brand/60 hover:text-brand mt-1.5 inline-block">
                            Or create a new character →
                          </Link>
                        </div>

                        <button
                          onClick={createRoom}
                          disabled={friendLoading}
                          className="w-full h-[48px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-white text-sm font-semibold ios-press shadow-lg shadow-brand/20 disabled:opacity-50"
                        >
                          {friendLoading ? "Creating..." : `Create Room with ${selectedFriend.anonymous_username}`}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {mode === "friend" && createdRoom && (
              <div className="flex flex-col items-center py-12">
                <p className="text-2xl font-bold text-foreground mb-2">Room created!</p>
                <p className="text-sm text-muted mb-2">Room #{friendRoomNumber}</p>
                <p className="text-xs text-muted mb-8 text-center max-w-xs">
                  Share this link with your friend to start roleplaying together.
                </p>
                <a
                  href={`/chat/${createdRoom}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full max-w-xs h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-white text-base font-semibold flex items-center justify-center ios-press shadow-lg shadow-brand/20 mb-3"
                >
                  Open Room #{friendRoomNumber}
                </a>
                <button
                  onClick={() => { setCreatedRoom(null); setSelectedFriend(null); setFriendResults([]); setFriendUsername(""); }}
                  className="text-sm text-muted hover:text-foreground transition-colors ios-press"
                >
                  Create Another Room
                </button>
              </div>
            )}
          </div>
        ) : null}

        {state.phase === "searching" && (
          <>
            <SearchingUI
              startTime={state.startTime}
              kinkTags={selectedTags}
              queuePosition={state.queuePosition}
              onCancel={cancelSearch}
            />
            <div className="border-t border-white/5 pt-4">
              <SuggestedBots kinkTags={selectedTags} />
            </div>
          </>
        )}

        {state.phase === "matched" && (
          <div className="flex flex-col items-center py-12">
            <div className="flex items-center justify-center gap-10 mb-8">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-brand/20">
                YOU
              </div>
              <div className="h-0.5 w-16 bg-brand" />
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-dark to-crimson-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-brand/20">
                ???
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground mb-2">Match found!</p>
            <p className="text-sm text-muted mb-2">Your anonymous partner is ready.</p>
            <p className="text-xs text-muted mb-8">Room #{roomNumber}</p>
            <a
              href={`/chat/${state.matchId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full max-w-xs h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-white text-base font-semibold flex items-center justify-center ios-press shadow-lg shadow-brand/20 mb-3"
            >
              Go to Room #{roomNumber}
            </a>
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
            <p className="text-sm text-muted mb-8">Try again or chat solo with a character.</p>
            <button
              onClick={() => dispatch({ type: "RESET" })}
              className="w-full max-w-xs h-[52px] rounded-full bg-gradient-to-r from-brand to-brand-dark text-white text-base font-semibold ios-press shadow-lg shadow-brand/20 mb-3"
            >
              Find Again
            </button>
            <a
              href="/explore"
              className="w-full max-w-xs h-[44px] rounded-full border border-white/15 text-muted hover:text-foreground hover:border-white/30 transition-all flex items-center justify-center text-sm ios-press"
            >
              Go Solo
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
