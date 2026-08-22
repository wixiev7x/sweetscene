"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SiteNav, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { getMyProfile } from "@/lib/actions/profile";
import { findMatch, createAIMatch } from "@/lib/actions/matchmaking";
import {
  startWaitingRoomSession,
  appendSoloMessage,
  deleteSoloSession,
} from "@/lib/actions/solo";
import { useMounted } from "@/lib/utils/useMounted";
import { sanitizeAndScrub, containsBlockedTerm } from "@/lib/utils/safety";
import ChatBox from "@/components/ChatBox";
import MessageList from "@/components/MessageList";

type Profile = {
  anonymous_username: string;
  anonymous_pfp_url: string | null;
  reputation_score: number;
  tokens_balance: number;
  is_vip: boolean;
};

/* ── local ChatMessage type (MessageList does not export it) ── */
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

type SoloMessage = {
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type WaitingCharacter = {
  id: string;
  name: string;
  avatar_url: string | null;
};

const SCENARIO_TAGS = [
  "hospital",
  "coffee_shop",
  "mansion",
  "library",
  "gym",
  "noir_office",
  "restaurant",
  "fitness",
  "clinic",
  "home",
  "service",
  "mystery",
];

const TIERS = [
  {
    id: "quick" as const,
    name: "Quick Chat",
    tokens: 2000,
    description: "A fast scene. 2k shared tokens.",
  },
  {
    id: "deep" as const,
    name: "Deep Dive",
    tokens: 10000,
    description: "A long scene. 10k shared tokens. VIP only.",
  },
];

const GRADIENTS = [
  ["from-brand", "to-crimson-500"],
  ["from-blue-500", "to-cyan-500"],
  ["from-amber-500", "to-red-500"],
  ["from-green-500", "to-teal-500"],
  ["from-indigo-500", "to-violet-500"],
] as const;

function hashGradient(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return sum % GRADIENTS.length;
}

/**
 * Converts solo session messages to the ChatMessage shape MessageList
 * expects. Loaded messages get stable IDs so React doesn't remount.
 */
function soloToChatMessages(
  soloMessages: SoloMessage[],
  characterId: string,
  characterName: string
): ChatMessage[] {
  return soloMessages.map((m, i) => ({
    id: `wr-${i}`,
    sender_type: m.role === "user" ? "human" : "ai",
    sender_id: m.role === "user" ? "me" : null,
    character_id: m.role === "assistant" ? characterId : null,
    character_name: m.role === "assistant" ? characterName : null,
    content: m.content,
    created_at: m.created_at,
    is_mine: m.role === "user",
  }));
}

/**
 * Lobby / matchmaking page for the sweetscene platform. Displays the user's
 * anonymous profile, tier selection, scenario tag picker, and a "Find
 * Match" button. While waiting for a human partner, an embedded
 * waiting-room AI chat panel keeps the user entertained — zero dead
 * time. When a match is found, a non-intrusive toast lets the user
 * choose: enter the scene or keep chatting.
 */
export default function LobbyPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();

  const [tier, setTier] = useState<"quick" | "deep">("quick");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [matchmaking, setMatchmaking] = useState(false);
  const [countdown, setCountdown] = useState(45);
  const [error, setError] = useState("");

  /* ── waiting room state ── */
  const [waitingSessionId, setWaitingSessionId] = useState<string | null>(
    null
  );
  const [waitingMessages, setWaitingMessages] = useState<ChatMessage[]>([]);
  const [waitingCharacter, setWaitingCharacter] =
    useState<WaitingCharacter | null>(null);
  const [waitingAiResponding, setWaitingAiResponding] = useState(false);
  const [waitingError, setWaitingError] = useState("");
  const [matchReady, setMatchReady] = useState(false);

  const waitingMatchIdRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  /* F10: clear the polling interval on unmount so it doesn't leak
     and call setState after the component is gone. */
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  /* ── create AI match (declared before the countdown effect that
         calls it, so it is never accessed before declaration). ── */
  const handleAIMatch = useCallback(async () => {
    /* Clean up the waiting room session if one exists. */
    if (waitingSessionId) {
      await deleteSoloSession(waitingSessionId);
      setWaitingSessionId(null);
    }

    try {
      const result = await createAIMatch(tier, selectedTags);
      setMatchmaking(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/chat/${result.matchId}`);
    } catch {
      setMatchmaking(false);
      setError("Failed to create AI match");
    }
  }, [tier, selectedTags, router, waitingSessionId]);

  /* ── fetch profile ── */
  useEffect(() => {
    async function fetchProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      /* B2: read profile via getMyProfile action — tokens_balance/is_vip
         are REVOKED from authenticated direct SELECT. */
      const profileResult = await getMyProfile();
      if ("profile" in profileResult) {
        setProfile({
          anonymous_username: profileResult.profile.anonymous_username,
          anonymous_pfp_url: profileResult.profile.anonymous_pfp_url,
          reputation_score: profileResult.profile.reputation_score,
          tokens_balance: profileResult.profile.tokens_balance,
          is_vip: profileResult.profile.is_vip,
        });
      }
      setLoading(false);
    }
    fetchProfile();
  }, [router]);

  /* ── error auto-dismiss ── */
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  /* ── countdown timer ── */
  useEffect(() => {
    if (!matchmaking) return;

    if (countdown <= 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      const aiHandle = setTimeout(() => handleAIMatch(), 0);
      return () => clearTimeout(aiHandle);
    }

    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [matchmaking, countdown, handleAIMatch]);

  /* ── waiting room: send a message ── */
  async function handleWaitingSend(text: string) {
    if (waitingAiResponding || !waitingSessionId || !waitingCharacter) return;

    /* Client-side safety gate (mirrors ChatBox's built-in filter). */
    if (containsBlockedTerm(text)) {
      setWaitingError("Message blocked");
      return;
    }
    const scrubbed = sanitizeAndScrub(text);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender_type: "human",
      sender_id: "me",
      character_id: null,
      character_name: null,
      content: scrubbed,
      created_at: new Date().toISOString(),
      is_mine: true,
    };

    setWaitingMessages((prev) => [...prev, userMsg]);
    setWaitingAiResponding(true);
    setWaitingError("");

    try {
      const result = await appendSoloMessage(waitingSessionId, text);

      if ("error" in result) {
        setWaitingMessages((prev) =>
          prev.filter((m) => m.id !== userMsg.id)
        );
        setWaitingError(result.error);
        return;
      }

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sender_type: "ai",
        sender_id: null,
        character_id: waitingCharacter.id,
        character_name: waitingCharacter.name,
        content: result.content,
        created_at: new Date().toISOString(),
        is_mine: false,
      };

      setWaitingMessages((prev) => [...prev, aiMsg]);
    } catch {
      setWaitingMessages((prev) =>
        prev.filter((m) => m.id !== userMsg.id)
      );
      setWaitingError("AI response failed");
    } finally {
      setWaitingAiResponding(false);
    }
  }

  /* ── enter the matched scene ── */
  async function handleEnterScene() {
    if (!waitingMatchIdRef.current) return;

    /* Clean up the waiting room session. */
    if (waitingSessionId) {
      await deleteSoloSession(waitingSessionId);
    }

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setMatchmaking(false);
    setMatchReady(false);
    router.push(`/chat/${waitingMatchIdRef.current}`);
  }

  /* ── dismiss the match-ready toast and keep chatting ── */
  function handleKeepChatting() {
    setMatchReady(false);
  }

  /* ── start finding a match ── */
  async function handleFindMatch() {
    setError("");

    if (selectedTags.length !== 2) {
      setError("Select exactly 2 scenario tags");
      return;
    }

    if (tier === "deep" && !profile?.is_vip) {
      setError("Deep Dive is VIP only");
      return;
    }

    setMatchmaking(true);
    setCountdown(45);
    setMatchReady(false);
    waitingMatchIdRef.current = null;

    /* Reset waiting room state. */
    setWaitingSessionId(null);
    setWaitingMessages([]);
    setWaitingCharacter(null);
    setWaitingError("");

    try {
      const result = await findMatch(tier, selectedTags);

      if ("error" in result) {
        setError(result.error);
        setMatchmaking(false);
        return;
      }

      if (result.waiting) {
        waitingMatchIdRef.current = result.matchId;

        /* Start the waiting room chat so there's zero dead time. */
        const wrResult = await startWaitingRoomSession();
        if (!("error" in wrResult)) {
          setWaitingSessionId(wrResult.sessionId);
          setWaitingCharacter({
            id: wrResult.character.id,
            name: wrResult.character.name,
            avatar_url: wrResult.character.avatar_url,
          });
          setWaitingMessages(
            soloToChatMessages(
              wrResult.messages,
              wrResult.character.id,
              wrResult.character.name
            )
          );
        }

        /* Poll for a human partner every 3 seconds. On join, show a
           toast instead of auto-redirecting — the user chooses. */
        const interval = setInterval(async () => {
          const supabase = createClient();
          const { data: match } = await supabase
            .from("matches")
            .select("user_b, status")
            .eq("id", result.matchId)
            .single();

          if (match && match.user_b !== null) {
            clearInterval(interval);
            pollingIntervalRef.current = null;
            setMatchReady(true);
          }
        }, 3000);

        pollingIntervalRef.current = interval;
      } else {
        router.push(`/chat/${result.matchId}`);
      }
    } catch {
      setError("Matchmaking failed");
      setMatchmaking(false);
    }
  }

  /* ── toggle a scenario tag ── */
  function handleTagToggle(tag: string) {
    if (matchmaking) return;

    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      if (prev.length >= 2) return prev;
      return [...prev, tag];
    });
  }

  /* ── re-fetch profile ── */
  async function handleRefreshProfile() {
    /* B2: use getMyProfile action (REVOKED columns). */
    const profileResult = await getMyProfile();
    if ("profile" in profileResult) {
      setProfile({
        anonymous_username: profileResult.profile.anonymous_username,
        anonymous_pfp_url: profileResult.profile.anonymous_pfp_url,
        reputation_score: profileResult.profile.reputation_score,
        tokens_balance: profileResult.profile.tokens_balance,
        is_vip: profileResult.profile.is_vip,
      });
    }
  }

  function getAvatarInitial(): string {
    return profile?.anonymous_username?.charAt(0).toUpperCase() ?? "?";
  }

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-void-950 flex flex-col items-center justify-center gap-4">
        <Spinner />
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void-950 text-white">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_20%,rgba(255,45,149,0.15)_0%,transparent_60%)]" />

      {/* ── NAV BAR ── */}
      <SiteNav />

      {/* ── MAIN CONTENT ── */}
      <main className="relative z-0 max-w-4xl mx-auto px-6 py-12">
        {/* ── PROFILE CARD ── */}
        <div className="flex items-center gap-6 bg-white/5 border border-white/10 rounded-2xl p-6">
          {profile?.anonymous_pfp_url ? (
            <div
              className="w-20 h-20 rounded-full bg-cover bg-center shrink-0"
              style={{ backgroundImage: `url(${profile.anonymous_pfp_url})` }}
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand to-crimson-500 flex items-center justify-center shrink-0">
              <span className="text-2xl text-white font-bold">
                {getAvatarInitial()}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-medium text-white truncate">
              {profile?.anonymous_username ?? "Anon"}
            </h2>
            <p className="text-sm text-muted-strong mt-1">
              &#9733; Reputation: {profile?.reputation_score ?? 0}
            </p>
            <p className="text-sm text-brand-light font-medium mt-0.5">
              &#9670; Tokens:{" "}
              {(profile?.tokens_balance ?? 0).toLocaleString()}
            </p>
            {profile?.is_vip && (
              <span className="inline-block mt-2 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full">
                VIP
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleRefreshProfile}
            className="text-xs text-muted hover:text-foreground-dim transition-colors shrink-0"
          >
            Refresh
          </button>
        </div>

        {/* ── TIER SELECTION ── */}
        <h2 className="text-2xl font-light text-foreground-dim mb-6 mt-12">
          Choose Your Time
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TIERS.map((t) => {
            const isSelected = tier === t.id;
            const isDeepLocked = t.id === "deep" && !profile?.is_vip;

            return (
              <button
                key={t.id}
                type="button"
                disabled={matchmaking}
                onClick={() => setTier(t.id)}
                className={[
                  "border rounded-2xl p-6 text-left transition-all duration-300",
                  matchmaking ? "cursor-not-allowed" : "cursor-pointer",
                  isSelected
                    ? "border-brand/50 bg-brand/10 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                    : "border-white/10 bg-white/5 hover:border-white/20",
                  isDeepLocked ? "opacity-60" : "",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium text-white">
                    {t.name}
                  </span>
                  {isDeepLocked && (
                    <span className="text-xs text-yellow-500/70">
                      &#128274; VIP only
                    </span>
                  )}
                </div>
                <p className="text-sm text-brand-light mt-1">
                  {t.tokens.toLocaleString()} tokens
                </p>
                <p className="text-sm text-muted mt-2">{t.description}</p>
              </button>
            );
          })}
        </div>

        {/* ── SCENARIO TAGS ── */}
        <h2 className="text-2xl font-light text-foreground-dim mb-2 mt-12">
          Pick 2 Scenarios
        </h2>
        <p className="text-sm text-muted mb-6">
          Select exactly 2 tags to match with someone in the same scene.
        </p>

        <div className="flex flex-wrap gap-3 max-w-2xl">
          {SCENARIO_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);

            return (
              <button
                key={tag}
                type="button"
                disabled={matchmaking}
                onClick={() => handleTagToggle(tag)}
                className={[
                  "px-4 py-2 rounded-full border text-sm transition-all duration-200 capitalize",
                  matchmaking
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer",
                  isSelected
                    ? "border-brand/50 bg-brand/10 text-brand-lighter shadow-[0_0_10px_rgba(168,85,247,0.1)]"
                    : "border-white/10 bg-white/5 text-muted-strong hover:border-white/20 hover:text-foreground-dim",
                ].join(" ")}
              >
                {tag.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-faint mt-3">
          ({selectedTags.length}/2 selected)
        </p>

        {/* ── FIND MATCH BUTTON ── */}
        <div className="max-w-md mx-auto mt-12">
          {matchmaking ? (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                disabled
                className="w-full bg-gradient-to-r from-brand-dark to-crimson-600 text-white font-medium text-lg py-4 rounded-xl opacity-80"
                style={{
                  animation: "searchPulse 1s infinite alternate ease-in-out",
                }}
              >
                Searching... {countdown}s
              </button>

              <div className="flex items-center gap-1.5 text-muted text-sm">
                <span>Scanning the fog</span>
                <span
                  className="block w-1.5 h-1.5 rounded-full bg-brand-light"
                  style={{
                    animation: "typingBounce 1.4s infinite ease-in-out",
                    animationDelay: "0s",
                  }}
                />
                <span
                  className="block w-1.5 h-1.5 rounded-full bg-brand-light"
                  style={{
                    animation: "typingBounce 1.4s infinite ease-in-out",
                    animationDelay: "0.2s",
                  }}
                />
                <span
                  className="block w-1.5 h-1.5 rounded-full bg-brand-light"
                  style={{
                    animation: "typingBounce 1.4s infinite ease-in-out",
                    animationDelay: "0.4s",
                  }}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleFindMatch}
              className="w-full bg-gradient-to-r from-brand-dark to-crimson-600 text-white font-medium text-lg py-4 rounded-xl hover:from-brand hover:to-crimson-500 active:scale-95 transform transition-all duration-300"
            >
              Find Match &rarr;
            </button>
          )}
        </div>

        {/* ── ERROR BANNER ── */}
        {error && (
          <div className="max-w-md mx-auto mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}

        {/* ── WAITING ROOM CHAT PANEL ── */}
        {matchmaking && waitingSessionId && waitingCharacter && (
          <div className="max-w-2xl mx-auto mt-8">
            {/* match-ready toast */}
            <AnimatePresence>
              {matchReady && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="mb-4 bg-gradient-to-r from-brand-dark/20 to-crimson-600/20 border border-brand/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">&#x1F3AD;</span>
                    <div>
                      <p className="text-sm text-white font-medium">
                        A match is ready.
                      </p>
                      <p className="text-xs text-muted-strong">
                        Your scene awaits.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleEnterScene}
                      className="bg-gradient-to-r from-brand-dark to-crimson-600 text-white text-sm font-medium px-5 py-2 rounded-xl hover:from-brand hover:to-crimson-500 active:scale-95 transition-all"
                    >
                      Enter scene
                    </button>
                    <button
                      type="button"
                      onClick={handleKeepChatting}
                      className="bg-white/5 border border-white/10 text-muted-strong text-sm px-5 py-2 rounded-xl hover:bg-white/10 transition-all"
                    >
                      Keep chatting
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* waiting room chat card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {/* header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                {waitingCharacter.avatar_url ? (
                  <div
                    className="w-8 h-8 rounded-full bg-cover bg-center shrink-0"
                    style={{
                      backgroundImage: `url(${waitingCharacter.avatar_url})`,
                    }}
                  />
                ) : (
                  <div
                    className={`w-8 h-8 rounded-full bg-gradient-to-br ${
                      GRADIENTS[hashGradient(waitingCharacter.name)][0]
                    } ${
                      GRADIENTS[hashGradient(waitingCharacter.name)][1]
                    } flex items-center justify-center shrink-0`}
                  >
                    <span className="text-xs text-white font-bold">
                      {waitingCharacter.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {waitingCharacter.name}
                  </p>
                  <p className="text-[10px] text-muted">
                    Waiting room &bull; free chat
                  </p>
                </div>
              </div>

              {/* message list (compact, fixed height) */}
              <div className="h-72 overflow-hidden">
                <MessageList
                  messages={waitingMessages}
                  currentUserId="me"
                />
              </div>

              {/* chat box */}
              <ChatBox
                isLocked={waitingAiResponding}
                isEnded={false}
                isRevealed={false}
                errorMessage={waitingError}
                onSend={handleWaitingSend}
              />
            </div>

            <p className="text-center text-xs text-muted-faint mt-3">
              Chatting while you wait. Your scene starts when you enter.
            </p>
          </div>
        )}

        {/* ── VIP UPSELL ── */}
        {profile && !profile.is_vip && !matchmaking && (
          <div className="max-w-md mx-auto mt-8 bg-gradient-to-br from-yellow-900/10 to-amber-900/10 border border-yellow-500/20 rounded-xl p-4 text-center">
            <p className="text-sm text-muted-strong">
              Want Deep Dive and unlimited matches?
            </p>
            <Link
              href="/profile"
              className="text-sm text-yellow-400 font-medium hover:text-yellow-300 transition-colors mt-1 inline-block"
            >
              Become VIP &rarr;
            </Link>
          </div>
        )}
      </main>

      {/* ── KEYFRAMES ── */}
      <style jsx>{`
        @keyframes searchPulse {
          0% {
            opacity: 0.7;
          }
          100% {
            opacity: 1;
          }
        }
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
