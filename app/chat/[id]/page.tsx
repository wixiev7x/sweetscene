"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateAIResponse } from "@/lib/actions/ai_wrapper";
import { generateImage } from "@/lib/actions/images";
import { requestReveal, moveOn as moveOnServer } from "@/lib/actions/reveal";
import { heartbeat } from "@/lib/actions/presence";
import {
  sendMessage,
  getMatchMessages,
  decryptMessageContent,
  reportConversation,
} from "@/lib/actions/messages";
import { getMyProfile } from "@/lib/actions/profile";
import { unmatch } from "@/lib/actions/match";
import { blockUser } from "@/lib/actions/blocks";
import { useMounted } from "@/lib/utils/useMounted";
import { Spinner } from "@/components/ui";
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
 * Chat room page for the sweetscene platform. Subscribes to real-time
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

  /* Phase 9.6: leave scene confirmation */
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  /* Reporting from inside the live scene. Previously the only report
     button was in /dm/[id], which requires status === "revealed" — so a
     user being harassed had to reveal their identity to their harasser
     before they could report them. This is the surface where two
     strangers actually talk, so it is the one that needs the control. */
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportCategory, setReportCategory] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const [reportDone, setReportDone] = useState(false);

  /* Blocking. blockUser/unblockUser/listMyBlocks and the claim_match
     pairing gate all existed with no UI anywhere, so the block feature
     was fully built and completely unreachable. The partner's id is
     already on the match row the client reads, so surfacing it here
     leaks nothing new. */
  const [blocking, setBlocking] = useState(false);
  const [blocked, setBlocked] = useState(false);

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
    if (!matchId || !mounted || !currentUserId) return;

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
    let sendResult;
    try {
      sendResult = await sendMessage(matchId, text);
    } catch {
      setError("Network error. Try again.");
      setSending(false);
      return;
    }

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
  } /* end handleSend */

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

  /* ── Phase 9.6: leave scene (instant disconnect) ── */
  async function handleLeaveScene() {
    setLeaveLoading(true);
    setError("");
    const result = await unmatch(matchId, "instant_disconnect");
    setLeaveLoading(false);
    setShowLeaveConfirm(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      router.push("/lobby");
    }
  }

  /* ── report the scene ──
     reportConversation snapshots the last 100 messages server-side as
     evidence, so the report survives the user leaving the scene right
     after filing it. The category is prefixed onto the reason rather
     than sent as a separate field — the server takes one free-text
     reason and the admin queue renders it verbatim. */
  async function handleReport() {
    if (reporting) return;

    const detail = reportReason.trim();
    if (!reportCategory && !detail) {
      setReportMsg("Pick a reason or describe what happened.");
      return;
    }

    setReporting(true);
    setReportMsg("");

    const reason = [reportCategory, detail].filter(Boolean).join(" — ");
    const result = await reportConversation(matchId, reason);

    setReporting(false);

    if ("error" in result) {
      setReportMsg(result.error);
      return;
    }

    setReportDone(true);
    setReportReason("");
    setReportCategory("");
  }

  /* Partner's profile id, or null for an AI match / not yet loaded. */
  function partnerId(): string | null {
    if (!match || match.is_ai_match || !currentUserId) return null;
    return match.user_a === currentUserId ? match.user_b : match.user_a;
  }

  /* ── block the partner ──
     Silent: the blocked user is never told. claim_match refuses to pair
     a blocked couple, so this is permanent unless undone from /profile. */
  async function handleBlock() {
    const target = partnerId();
    if (!target || blocking || blocked) return;

    setBlocking(true);
    const result = await blockUser(target);
    setBlocking(false);

    if ("error" in result) {
      setReportMsg(result.error);
      return;
    }
    setBlocked(true);
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
        <Spinner />
        <p className="text-muted text-sm">Loading scene...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-muted text-sm">Match not found.</p>
      </div>
    );
  }

  const showEnded =
    match.status === "ended" || match.status === "revealed";
  const isLocked = match.ai_turn_due || sending || showEnded;

  /* ── Room name: deterministic from matchId ── */
  const ROOM_NAMES = [
    "Velvet Hour", "Crimson Veil", "Amber Haze", "Indigo Dusk",
    "Rose Cipher", "Obsidian Bloom", "Scarlet Fog", "Ivory Dark",
    "Gilded Dusk", "Violet Hollow",
  ];
  const roomName = ROOM_NAMES[
    parseInt(matchId.replace(/-/g, "").slice(0, 8), 16) % ROOM_NAMES.length
  ];

  return (
    <div
      className="h-[100dvh] flex overflow-hidden"
      style={{ background: "var(--chat-bg)", color: "var(--chat-text-primary)" }}
    >
      {/* ══ DESKTOP SIDEBAR (≥768px) ══ */}
      <aside
        className="hidden md:flex flex-col shrink-0 w-[200px] h-full"
        style={{
          background: "#0a0007",
          borderRight: "1px solid var(--chat-divider)",
        }}
      >
        {/* Wordmark */}
        <div className="px-5 pt-6 pb-5">
          <span
            className="text-xl italic"
            style={{ color: "var(--chat-text-primary)", fontFamily: "var(--font-fraunces)" }}
          >
            sweetscene
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 flex flex-col gap-1">
          {[
            { label: "Home",      href: "/" },
            { label: "Roleplay",  href: "/lobby" },
            { label: "My Scenes", href: "/characters/my" },
            { label: "Profile",   href: "/profile" },
          ].map(({ label, href }) => {
            const active = href === "/lobby";
            return (
              <Link
                key={label}
                href={href}
                className="px-3 py-2.5 rounded-lg text-xs uppercase tracking-widest transition-colors"
                style={{
                  fontFamily: "var(--font-space)",
                  background: active ? "rgba(201,54,95,0.14)" : "transparent",
                  color: active ? "var(--chat-bubble-user)" : "var(--chat-text-muted)",
                  letterSpacing: "0.06em",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Token pool at bottom of sidebar */}
        <div className="px-4 py-5 mt-auto">
          <p
            className="text-[10px] uppercase tracking-widest mb-1"
            style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-space)" }}
          >
            Token pool
          </p>
          <p
            className="text-sm font-medium"
            style={{ color: "var(--chat-bubble-user)", fontFamily: "var(--font-manrope)" }}
          >
            {match.shared_pool.toLocaleString()}
          </p>
          <div
            className="mt-1.5 w-full h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${poolPercent()}%`,
                background: "var(--chat-bubble-user)",
              }}
            />
          </div>
        </div>
      </aside>

      {/* ══ CHAT COLUMN ══ */}
      <div className="flex-1 flex flex-col min-w-0 h-full">

        {/* ── HEADER ── */}
        <ChatHeader
          roomName={roomName}
          matchTier={match.tier}
          onReport={() => { setReportDone(false); setReportMsg(""); setShowReport(true); }}
          onLeave={match.status === "active" ? () => setShowLeaveConfirm(true) : undefined}
          onGenerateImage={profile?.is_vip ? handleGenerateImage : undefined}
          imageLoading={imageLoading}
          backHref="/lobby"
        />

        {/* ── MESSAGE LIST ── */}
        <div className="flex-1 overflow-hidden">
          <MessageList messages={messages} currentUserId={currentUserId ?? ""} />
        </div>

        {/* ── CHAT BOX ── */}
        <ChatBox
          isLocked={isLocked}
          isEnded={match.status === "ended"}
          isRevealed={match.status === "revealed"}
          errorMessage={error}
          onSend={handleSend}
          freeMessagesLeft={
            profile && !profile.is_vip
              ? Math.max(0, 17 - (profile.reputation_score ?? 0))
              : undefined
          }
        />
      </div>

      {/* ── FADE TO BLACK ── */}
      {(match.status === "ended" || match.status === "revealed") && (
        <FadeToBlack
          matchId={matchId}
          isRevealed={revealState.hasRevealed}
          partnerRevealed={revealState.partnerRevealed}
          partnerMovedOn={revealState.partnerMovedOn}
          isAiMatch={match.is_ai_match}
          onReveal={handleReveal}
          onMoveOn={handleMoveOn}
          onVibeCheckComplete={handleVibeCheckComplete}
        />
      )}

      {/* ── IMAGE MODAL ── */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => { setShowImageModal(false); setGeneratedImageUrl(null); }}
        >
          <div
            className="max-w-lg w-full rounded-2xl p-6 text-center"
            style={{ background: "#14090f", border: "1px solid var(--chat-divider)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {imageLoading ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <p className="text-sm" style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-manrope)" }}>Generating scene...</p>
              </div>
            ) : generatedImageUrl ? (
              <div className="flex flex-col items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={generatedImageUrl} alt="Generated scene" className="max-w-full rounded-xl" />
                <button type="button" onClick={() => { setShowImageModal(false); setGeneratedImageUrl(null); }}
                  className="px-4 py-2 rounded-lg text-sm transition-all hover:bg-white/10"
                  style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-manrope)" }}>Close</button>
              </div>
            ) : (
              <p className="text-sm py-8" style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-manrope)" }}>Could not generate image.</p>
            )}
          </div>
        </div>
      )}

      {/* ── LEAVE SCENE CONFIRMATION ── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl p-8 text-center"
            style={{ background: "#14090f", border: "1px solid var(--chat-divider)" }}>
            <h2 className="text-xl italic mb-2" style={{ color: "var(--chat-text-primary)", fontFamily: "var(--font-fraunces)" }}>Leave this scene?</h2>
            <p className="text-sm mt-2 mb-6" style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-manrope)" }}>
              Your shared token pool will be consumed and this match will end.
            </p>
            {partnerId() && (
              <label className="flex items-start gap-3 text-left mb-5 cursor-pointer">
                <input type="checkbox" checked={blocked} disabled={blocking || blocked} onChange={handleBlock} className="mt-0.5 accent-red-500" />
                <span className="text-sm" style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-manrope)" }}>
                  {blocked ? "Blocked. You won't be matched again." : "Also block this user — they aren't told."}
                </span>
              </label>
            )}
            <div className="flex flex-col gap-3">
              <button type="button" onClick={handleLeaveScene} disabled={leaveLoading}
                className="w-full font-medium py-3 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                style={{ background: "#c9365f", color: "#f3e4e9", fontFamily: "var(--font-manrope)" }}>
                {leaveLoading ? "Leaving..." : "Yes, leave scene"}
              </button>
              <button type="button" onClick={() => setShowLeaveConfirm(false)}
                className="text-sm transition-colors"
                style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-manrope)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORT THIS SCENE ── */}
      {showReport && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl p-8"
            style={{ background: "#14090f", border: "1px solid var(--chat-divider)" }}>
            {reportDone ? (
              <div className="text-center">
                <h2 className="text-xl italic mb-2" style={{ color: "var(--chat-text-primary)", fontFamily: "var(--font-fraunces)" }}>Report submitted</h2>
                <p className="text-sm mb-6" style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-manrope)" }}>
                  A moderator will review the conversation.
                </p>
                <button type="button" onClick={() => { setShowReport(false); setReportDone(false); setReportMsg(""); }}
                  className="text-sm transition-colors"
                  style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-manrope)" }}>Close</button>
              </div>
            ) : (
              <>
                <h2 className="text-xl italic mb-2" style={{ color: "var(--chat-text-primary)", fontFamily: "var(--font-fraunces)" }}>Report this scene</h2>
                <p className="text-sm mb-5" style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-manrope)" }}>
                  The last 100 messages are attached as evidence.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {["Harassment","Sexual content involving a minor","Threats or violence","Asking for personal info","Spam or scam","Other"].map((cat) => (
                    <button key={cat} type="button"
                      onClick={() => setReportCategory((prev) => prev === cat ? "" : cat)}
                      className="px-3 py-1.5 rounded-full text-xs border transition-all"
                      style={{
                        background: reportCategory === cat ? "rgba(201,54,95,0.15)" : "rgba(255,255,255,0.04)",
                        borderColor: reportCategory === cat ? "rgba(201,54,95,0.4)" : "rgba(255,255,255,0.1)",
                        color: reportCategory === cat ? "#c9365f" : "var(--chat-text-muted)",
                        fontFamily: "var(--font-space)",
                      }}>
                      {cat}
                    </button>
                  ))}
                </div>
                <label htmlFor="report-detail" className="sr-only">What happened</label>
                <textarea id="report-detail" value={reportReason} onChange={(e) => setReportReason(e.target.value)}
                  maxLength={1000} rows={4} placeholder="What happened? (optional)"
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "var(--chat-text-primary)", fontFamily: "var(--font-manrope)" }} />
                {reportMsg && <p className="mt-3 text-sm text-red-400">{reportMsg}</p>}
                <div className="flex flex-col gap-3 mt-5">
                  <button type="button" onClick={handleReport} disabled={reporting}
                    className="w-full font-medium py-3 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                    style={{ background: "#c9365f", color: "#f3e4e9", fontFamily: "var(--font-manrope)" }}>
                    {reporting ? "Submitting..." : "Submit report"}
                  </button>
                  <button type="button" onClick={() => { setShowReport(false); setReportMsg(""); }}
                    className="text-sm transition-colors"
                    style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-manrope)" }}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

}

/* ══════════════════════════════════════════════════════════════════
 * ChatHeader — local component
 * Left: back arrow + room name (Fraunces italic) + tier badge
 * Right: diagonal 3-dot menu → Cancel / Report / Regenerate / Leave
 * ══════════════════════════════════════════════════════════════════ */
type ChatHeaderProps = {
  roomName: string;
  matchTier: "quick" | "deep";
  onReport: () => void;
  onLeave?: () => void;
  onGenerateImage?: () => void;
  imageLoading?: boolean;
  backHref: string;
};

function ChatHeader({
  roomName,
  matchTier,
  onReport,
  onLeave,
  onGenerateImage,
  imageLoading,
  backHref,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <header
      className="shrink-0 flex items-center justify-between px-4 h-14 relative"
      style={{
        background: "var(--chat-bg)",
        borderBottom: "1px solid var(--chat-divider)",
      }}
    >
      {/* Left: back + room name */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href={backHref}
          aria-label="Back"
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-white/5"
          style={{ color: "var(--chat-text-muted)" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        <div className="min-w-0">
          <p
            className="text-base italic leading-none truncate"
            style={{ color: "var(--chat-text-primary)", fontFamily: "var(--font-fraunces)" }}
          >
            {roomName}
          </p>
          <p
            className="text-[10px] uppercase tracking-widest mt-0.5"
            style={{ color: "var(--chat-text-muted)", fontFamily: "var(--font-space)" }}
          >
            {matchTier === "deep" ? "Deep Dive" : "Quick Chat"}
          </p>
        </div>
      </div>

      {/* Right: 3-dot diagonal menu trigger */}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-label="Chat options"
          onClick={() => setMenuOpen((v) => !v)}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-white/5"
          style={{ color: "var(--chat-text-muted)" }}
        >
          {/* Diagonal 3-dot arrangement */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <circle cx="5"  cy="15" r="1.6" />
            <circle cx="10" cy="10" r="1.6" />
            <circle cx="15" cy="5"  r="1.6" />
          </svg>
        </button>

        {menuOpen && (
          <div
            className="ctx-menu-in absolute right-0 top-full mt-1 min-w-[190px] rounded-xl overflow-hidden shadow-2xl z-50"
            style={{
              background: "#14090f",
              border: "1px solid var(--chat-divider)",
            }}
          >
            {[
              { label: "Cancel Chat",             action: onLeave,          danger: false },
              { label: "Report Chat",              action: onReport,         danger: true  },
              { label: "Regenerate Last Message",  action: onGenerateImage ?? (() => {}), danger: false, disabled: !onGenerateImage || imageLoading },
            ].map(({ label, action, danger, disabled }) => (
              <button
                key={label}
                type="button"
                disabled={disabled}
                onClick={() => { setMenuOpen(false); if (action) action(); }}
                className="w-full text-left px-4 py-3 text-sm transition-colors hover:bg-white/5 disabled:opacity-30"
                style={{
                  color: danger ? "#f87171" : "var(--chat-text-primary)",
                  fontFamily: "var(--font-manrope)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
