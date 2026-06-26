"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateAIResponse } from "@/lib/actions/ai_wrapper";
import { generateImage } from "@/lib/actions/images";
import { requestReveal, moveOn as moveOnServer } from "@/lib/actions/reveal";
import { heartbeat } from "@/lib/actions/presence";
import { sendMessage, getMatchMessages, decryptMessageContent } from "@/lib/actions/messages";
import { getMyProfile } from "@/lib/actions/profile";
import { useMounted } from "@/lib/utils/useMounted";
import ChatBox from "@/components/ChatBox";
import MessageList from "@/components/MessageList";
import FadeToBlack from "@/components/FadeToBlack";

/* ── local types (MessageList does not export ChatMessage) ── */
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

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string | null;
  is_ai_match: boolean;
  status: "active" | "ended" | "revealed";
  tier: "quick" | "deep";
  scenario_tags: string[];
  shared_pool: number;
  human_message_count: number;
  ai_turn_due: boolean;
  character_ids: string[];
  ai_interval: number;
  last_activity: string;
  created_at: string;
  ended_at: string | null;
  user_a_revealed: boolean;
  user_b_revealed: boolean;
  user_a_moved_on: boolean;
  user_b_moved_on: boolean;
};

type ProfileRow = {
  id: string;
  anonymous_username: string;
  anonymous_pfp_url: string | null;
  reputation_score: number;
  tokens_balance: number;
  is_vip: boolean;
};

type RevealState = {
  hasRevealed: boolean;
  partnerRevealed: boolean;
  partnerMovedOn: boolean;
};

const INITIAL_POOL: Record<"quick" | "deep", number> = {
  quick: 2000,
  deep: 10000,
};

/**
 * Chat room page for the chatty platform. Subscribes to real-time
 * message and match updates, triggers AI turns when the message
 * threshold is met, and shows the FadeToBlack overlay when the
 * match ends.
 */
export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const matchId = params.id;

  /* ── state ── */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [partnerUsername, setPartnerUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const mounted = useMounted();

  /* image generation */
  const [showImageModal, setShowImageModal] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [imageLoading, setImageLoading] = useState(false);

  /* reveal flow */
  const [revealState, setRevealState] = useState<RevealState>({
    hasRevealed: false,
    partnerRevealed: false,
    partnerMovedOn: false,
  });

  /* character name map lives in state so it can be read during render
     (accessing a ref during render is unsafe). A ref mirror keeps the
     latest value available to async real-time callbacks. */
  const [characterNameMap, setCharacterNameMap] = useState<
    Map<string, string>
  >(new Map());
  const characterNameMapRef = useRef<Map<string, string>>(new Map());

  /* ── AI turn guard: prevents the effect and a real-time UPDATE
     from both firing generateAIResponse for the same turn ── */
  const aiTurnFiringRef = useRef(false);

  /* ── A4: silence-nudge — tracks the last human send time so a
     15-second idle interval can request an AI nudge. */
  const lastSendTimeRef = useRef<number>(0);
  const nudgeFiredRef = useRef(false);

  /* ── initial load ── */
  useEffect(() => {
    async function init() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUserId(user.id);

      /* Initialize the silence-nudge timer to page load time. */
      lastSendTimeRef.current = Date.now();

      /* B3: read profile via getMyProfile action (tokens_balance/is_vip
         REVOKED from authenticated direct SELECT). */
      const profileResult = await getMyProfile();
      if ("profile" in profileResult) {
        setProfile({
          id: profileResult.profile.id,
          anonymous_username: profileResult.profile.anonymous_username,
          anonymous_pfp_url: profileResult.profile.anonymous_pfp_url,
          reputation_score: profileResult.profile.reputation_score,
          tokens_balance: profileResult.profile.tokens_balance,
          is_vip: profileResult.profile.is_vip,
        });
      }

      const { data: matchData } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (!matchData) {
        setError("Match not found");
        setLoading(false);
        return;
      }

      const m = matchData as MatchRow;
      setMatch(m);

      /* seed reveal state from the persisted match flags so a reload
         of a finished scene reflects the real consent state. */
      const isA = m.user_a === user.id;
      setRevealState({
        hasRevealed: isA ? m.user_a_revealed : m.user_b_revealed,
        partnerRevealed: isA ? m.user_b_revealed : m.user_a_revealed,
        partnerMovedOn: isA ? m.user_b_moved_on : m.user_a_moved_on,
      });

      /* build character name map from DB */
      if (m.character_ids && m.character_ids.length > 0) {
        const nextMap = new Map<string, string>();
        for (const cid of m.character_ids) {
          const { data: dbChar } = await supabase
            .from("characters")
            .select("name")
            .eq("id", cid)
            .single();
          nextMap.set(cid, dbChar?.name ?? "Director");
        }
        setCharacterNameMap(nextMap);
        characterNameMapRef.current = nextMap;
      }

      /* fetch partner username if not AI match */
      if (!m.is_ai_match) {
        const partnerId = m.user_a === user.id ? m.user_b : m.user_a;
        if (partnerId) {
          const { data: partnerProfile } = await supabase
            .from("profiles")
            .select("anonymous_username")
            .eq("id", partnerId)
            .single();
          if (partnerProfile) {
            setPartnerUsername(partnerProfile.anonymous_username);
          }
        }
      }

      /* fetch existing messages (decrypted server-side) */
      const msgResult = await getMatchMessages(matchId);

      if ("error" in msgResult) {
        setError(msgResult.error);
      } else {
        const nameMap = characterNameMapRef.current;
        const transformed: ChatMessage[] = msgResult.messages.map((msg) => ({
          id: msg.id,
          sender_type: msg.sender_type,
          sender_id: msg.sender_id,
          character_id: msg.character_id,
          character_name: msg.character_id
            ? nameMap.get(msg.character_id) ?? null
            : null,
          content: msg.content,
          created_at: msg.created_at,
          is_mine: msg.sender_id === user.id,
        }));
        setMessages(transformed);
      }

      setLoading(false);
    }

    init();
  }, [matchId, router]);

  /* ── heartbeat: keep the match alive while the tab is visible ── */
  useEffect(() => {
    if (!matchId || !mounted) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    function startHeartbeat() {
      if (interval) return;
      interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          heartbeat(matchId);
        }
      }, 30000);
      /* Fire once immediately on focus. */
      heartbeat(matchId);
    }

    function stopHeartbeat() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    }

    startHeartbeat();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopHeartbeat();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [matchId, mounted]);

  /* ── real-time subscription ── */
  useEffect(() => {
    if (!matchId || !mounted) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`chat:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const msg = payload.new;
          const msgId = msg.id as string;
          const senderId = (msg.sender_id as string) ?? null;
          const characterId = (msg.character_id as string) ?? null;
          const encryptedContent = msg.content as string;
          const isMine = senderId === currentUserId;

          /* If this is my own message, skip — it was already added
             optimistically in handleSend. */
          if (isMine) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msgId)) return prev;
              return [
                ...prev,
                {
                  id: msgId,
                  sender_type: msg.sender_type as "human" | "ai",
                  sender_id: senderId,
                  character_id: characterId,
                  character_name: null,
                  content: encryptedContent,
                  created_at: msg.created_at as string,
                  is_mine: true,
                },
              ];
            });
            return;
          }

          /* For AI or partner messages, the content is encrypted —
             decrypt it server-side before displaying. */
          decryptMessageContent(matchId, encryptedContent).then(
            (decrypted) => {
              const content =
                "error" in decrypted ? "[unreadable]" : decrypted.content;

              const newMessage: ChatMessage = {
                id: msgId,
                sender_type: msg.sender_type as "human" | "ai",
                sender_id: senderId,
                character_id: characterId,
                character_name: characterId
                  ? characterNameMapRef.current.get(characterId) ?? null
                  : null,
                content,
                created_at: msg.created_at as string,
                is_mine: false,
              };

              setMessages((prev) => {
                if (prev.some((m) => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
              });
            }
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new;
          setMatch((prev) =>
            prev
              ? {
                  ...prev,
                  shared_pool: updated.shared_pool as number,
                  status: updated.status as "active" | "ended" | "revealed",
                  human_message_count: updated.human_message_count as number,
                  ai_turn_due: updated.ai_turn_due as boolean,
                  last_activity: updated.last_activity as string,
                  ended_at: (updated.ended_at as string) ?? null,
                  user_a_revealed:
                    (updated.user_a_revealed as boolean) ?? false,
                  user_b_revealed:
                    (updated.user_b_revealed as boolean) ?? false,
                  user_a_moved_on:
                    (updated.user_a_moved_on as boolean) ?? false,
                  user_b_moved_on:
                    (updated.user_b_moved_on as boolean) ?? false,
                }
              : prev
          );

          /* Derive reveal state from the partner's perspective. */
          if (currentUserId) {
            const isA = (updated.user_a as string) === currentUserId;
            const ownRevealed = isA
              ? (updated.user_a_revealed as boolean)
              : (updated.user_b_revealed as boolean);
            const partnerRevealed = isA
              ? (updated.user_b_revealed as boolean)
              : (updated.user_a_revealed as boolean);
            const partnerMovedOn = isA
              ? (updated.user_b_moved_on as boolean)
              : (updated.user_a_moved_on as boolean);
            setRevealState((prev) => ({
              hasRevealed: ownRevealed ?? prev.hasRevealed,
              partnerRevealed: partnerRevealed ?? prev.partnerRevealed,
              partnerMovedOn: partnerMovedOn ?? prev.partnerMovedOn,
            }));

            /* Phase 6: auto-route to /dm is removed — the Vibe Check overlay
               now handles routing via onVibeCheckComplete after the
               user rates the scene. The revealRoutingRef is no longer
               used for auto-routing. */
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, mounted, currentUserId, router]);

  /* ── A4: silence nudge — every 15s while the tab is visible and the
     match is active, check if no human has sent a message in the last
     15s. If so, call requestAINudge (server-side gated to >15s idle).
     The nudgeFiredRef prevents repeated nudges until the next user
     message resets it. */
  useEffect(() => {
    if (!matchId || !mounted) return;

    const interval = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      if (!match || match.status !== "active") return;
      if (match.ai_turn_due) return;

      const idle = Date.now() - lastSendTimeRef.current;
      if (idle > 15000 && !nudgeFiredRef.current) {
        nudgeFiredRef.current = true;
        try {
          const { requestAINudge } = await import("@/lib/actions/ai_wrapper");
          await requestAINudge(matchId);
        } catch {
          nudgeFiredRef.current = false;
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [matchId, mounted, match]);

  /* ── AI turn trigger ── */
  useEffect(() => {
    if (!match || !matchId) return;
    if (match.status !== "active") return;
    if (!match.ai_turn_due) return;
    if (aiTurnFiringRef.current) return;

    aiTurnFiringRef.current = true;
    generateAIResponse(matchId)
      .catch(() => setError("AI failed to respond"))
      .finally(() => {
        aiTurnFiringRef.current = false;
      });
  }, [match, matchId]);

  /* ── send a human message ── */
  async function handleSend(text: string) {
    if (sending) return;
    if (!match || match.status !== "active") return;
    if (match.ai_turn_due) return;

    setSending(true);
    setError("");

    /* Send via the encrypted message action — content is encrypted
       server-side before INSERT. Returns the plaintext for optimistic
       display. */
    const sendResult = await sendMessage(matchId, text);

if ("error" in sendResult) {
      setError(sendResult.error);
      setSending(false);
      return;
    }

    /* Add the user's own message optimistically — Realtime will also
        fire but we deduplicate by ID. */
    const userMsg: ChatMessage = {
      id: sendResult.messageId,
      sender_type: "human",
      sender_id: currentUserId,
      character_id: null,
      character_name: null,
      content: sendResult.content,
      created_at: new Date().toISOString(),
      is_mine: true,
    };
    setMessages((prev) => {
      if (prev.some((m) => m.id === userMsg.id)) return prev;
      return [...prev, userMsg];
    });

    /* C1/M2: the send_human_message RPC atomically incremented the
       counter and computed ai_turn_due. We use the RPC's return
       values to update local state optimistically — NO client-side
       matches.update anymore. Realtime will deliver the authoritative
       match row if the AI turn fires. */
    setMatch(
      (prev) =>
        prev
          ? {
              ...prev,
              human_message_count: sendResult.aiTurnDue ? 0 : sendResult.humanMessageCount,
              ai_turn_due: sendResult.aiTurnDue,
              last_activity: new Date().toISOString(),
            }
          : prev
    );

    /* A3: direct-address trigger — if the user's message contains
       @<characterName> or @director/@ai/@narrator and no AI turn is
       already due, call requestDirectAINudge to flip ai_turn_due
       server-side. The Realtime match UPDATE then fires the effect. */
    if (!sendResult.aiTurnDue) {
      const text = sendResult.content.toLowerCase();
      const characterNames = Array.from(characterNameMapRef.current.values());
      const addressed = characterNames.some(
        (name) => name && text.includes(`@${name.toLowerCase()}`)
      ) ||
        text.includes("@director") ||
        text.includes("@ai") ||
        text.includes("@narrator");

      if (addressed) {
        try {
          const { requestDirectAITurn } = await import("@/lib/actions/ai_wrapper");
          await requestDirectAITurn(matchId);
          /* Optimistically flip ai_turn_due so the UI shows the
             "AI is typing" state immediately. */
          setMatch((prev) => (prev ? { ...prev, ai_turn_due: true } : prev));
        } catch {
          /* Non-fatal — the RPC is server-side gated. */
        }
      }
    }

    /* Track last send time for the silence-nudge interval. */
    lastSendTimeRef.current = Date.now();
    nudgeFiredRef.current = false;

    setSending(false);
  }

  /* ── VIP image generation ── */
  async function handleGenerateImage() {
    if (!profile?.is_vip) return;
    if (imageLoading) return;

    setImageLoading(true);
    setShowImageModal(true);
    setGeneratedImageUrl(null);

    const result = await generateImage(matchId);
    if ("error" in result) {
      setError(result.error);
    } else {
      setGeneratedImageUrl(result.imageUrl);
    }
    setImageLoading(false);
  }

  /* ── reveal handlers ── */
  async function handleReveal() {
    if (revealState.hasRevealed) return;
    setRevealState((prev) => ({ ...prev, hasRevealed: true }));
    const result = await requestReveal(matchId);
    if ("error" in result) {
      setRevealState((prev) => ({ ...prev, hasRevealed: false }));
      setError(result.error);
      return;
    }
    setRevealState({
      hasRevealed: result.ownRevealed,
      partnerRevealed: result.partnerRevealed,
      partnerMovedOn: result.partnerMovedOn,
    });
    /* Phase 6: no auto-route to /dm here — the Vibe Check overlay
       handles routing after the user rates. */
  }

  async function handleMoveOn() {
    await moveOnServer(matchId);
  }

  /* ── Phase 6: Vibe Check completion — routes after the user rates
     (or skips). If both revealed → /dm; otherwise → /lobby. */
  function handleVibeCheckComplete() {
    if (revealState.hasRevealed && revealState.partnerRevealed) {
      router.push(`/dm/${matchId}`);
    } else {
      router.push("/lobby");
    }
  }

  /* ── progress bar ── */
  function poolPercent(): number {
    if (!match) return 100;
    const max = INITIAL_POOL[match.tier] || 2000;
    const pct = (match.shared_pool / max) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  /* ── character list for header ── */
  function characterList(): string {
    if (!match?.character_ids) return "";
    return match.character_ids
      .map((cid) => `\u{1F3AD} ${characterNameMap.get(cid) ?? "AI"}`)
      .join(", ");
  }

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
        <p className="text-gray-500 text-sm">Loading scene...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-500 text-sm">Match not found.</p>
      </div>
    );
  }

  const showEnded =
    match.status === "ended" || match.status === "revealed";
  const isLocked = match.ai_turn_due || sending || showEnded;

  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
      {/* background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(88,28,135,0.08)_0%,transparent_50%)]" />

      {/* ── HEADER ── */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md bg-black/60 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* left */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/lobby"
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors shrink-0"
            >
              &larr;
            </Link>

            <div className="min-w-0">
              {match.is_ai_match ? (
                <>
                  <p className="text-sm text-purple-400 font-medium">
                    AI Match
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {characterList()}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-white font-medium truncate">
                    {partnerUsername ?? "Stranger"}
                  </p>
                  <p className="text-xs text-gray-500">Stranger</p>
                </>
              )}
            </div>
          </div>

          {/* center */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <span
              className={[
                "text-xs px-2 py-1 rounded-full border",
                match.tier === "deep"
                  ? "border-pink-500/30 text-pink-400"
                  : "border-purple-500/30 text-purple-400",
              ].join(" ")}
            >
              {match.tier === "deep" ? "Deep Dive" : "Quick Chat"}
            </span>
            <span className="text-xs text-gray-500">
              {(match.scenario_tags ?? [])
                .map((t: string) => t.replace(/_/g, " "))
                .join(" \u2022 ")}
            </span>
          </div>

          {/* right */}
          <div className="flex items-center gap-4 shrink-0">
            {/* pool */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm text-purple-400 font-medium">
                &#9670; {match.shared_pool.toLocaleString()} tokens
              </span>
              <div className="w-24 h-1 rounded-full bg-white/10 mt-1">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                  style={{ width: `${poolPercent()}%` }}
                />
              </div>
            </div>

            {/* VIP image button */}
            {profile?.is_vip && (
              <button
                type="button"
                onClick={handleGenerateImage}
                disabled={imageLoading}
                className="text-xs bg-white/5 border border-white/10 text-gray-400 px-3 py-1.5 rounded-lg hover:bg-white/10 hover:text-gray-300 transition-all"
              >
                &#x1F5BC;&#xFE0F; Generate
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── MESSAGE LIST ── */}
      <div className="flex-1 overflow-hidden relative">
        <MessageList messages={messages} currentUserId={currentUserId ?? ""} />
      </div>

      {/* ── CHAT BOX ── */}
      <ChatBox
        isLocked={isLocked}
        isEnded={match.status === "ended"}
        isRevealed={match.status === "revealed"}
        errorMessage={error}
        onSend={handleSend}
      />

      {/* ── FADE TO BLACK ── */}
      {(match.status === "ended" || match.status === "revealed") && (
        <FadeToBlack
          matchId={matchId}
          isRevealed={revealState.hasRevealed}
          partnerRevealed={revealState.partnerRevealed}
          partnerMovedOn={revealState.partnerMovedOn}
          onReveal={handleReveal}
          onMoveOn={handleMoveOn}
          onVibeCheckComplete={handleVibeCheckComplete}
        />
      )}

      {/* ── IMAGE MODAL ── */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => {
            setShowImageModal(false);
            setGeneratedImageUrl(null);
          }}
        >
          <div
            className="max-w-lg w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {imageLoading ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <p className="text-gray-400 text-sm">Generating scene...</p>
                <div className="flex items-center gap-1.5">
                  <span
                    className="block w-2 h-2 rounded-full bg-purple-400"
                    style={{
                      animation:
                        "typingBounce 1.4s infinite ease-in-out",
                      animationDelay: "0s",
                    }}
                  />
                  <span
                    className="block w-2 h-2 rounded-full bg-purple-400"
                    style={{
                      animation:
                        "typingBounce 1.4s infinite ease-in-out",
                      animationDelay: "0.2s",
                    }}
                  />
                  <span
                    className="block w-2 h-2 rounded-full bg-purple-400"
                    style={{
                      animation:
                        "typingBounce 1.4s infinite ease-in-out",
                      animationDelay: "0.4s",
                    }}
                  />
                </div>
              </div>
            ) : generatedImageUrl ? (
              <div className="flex flex-col items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={generatedImageUrl}
                  alt="Generated scene"
                  className="max-w-full rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowImageModal(false);
                    setGeneratedImageUrl(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-white/10 text-gray-400 text-sm hover:bg-white/20 transition-all"
                >
                  Close
                </button>
              </div>
            ) : (
              <p className="text-gray-500 text-sm py-8">
                Could not generate image.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── KEYFRAMES ── */}
      <style jsx>{`
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
