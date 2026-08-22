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
      <div className="min-h-screen bg-void-950 flex flex-col items-center justify-center gap-4">
        <Spinner />
        <p className="text-muted text-sm">Loading scene...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-void-950 flex items-center justify-center">
        <p className="text-muted text-sm">Match not found.</p>
      </div>
    );
  }

  const showEnded =
    match.status === "ended" || match.status === "revealed";
  const isLocked = match.ai_turn_due || sending || showEnded;

  return (
    <div className="h-screen flex flex-col bg-void-950 text-white overflow-hidden">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,45,149,0.08)_0%,transparent_50%)]" />

      {/* ── HEADER ── */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md bg-void-950/60 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* left */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/lobby"
              className="text-sm text-muted hover:text-foreground-dim transition-colors shrink-0"
            >
              &larr;
            </Link>

            <div className="min-w-0">
              {match.is_ai_match ? (
                <>
                  <p className="text-sm text-brand-light font-medium">
                    AI Match
                  </p>
                  <p className="text-xs text-muted truncate">
                    {characterList()}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-white font-medium truncate">
                    {partnerUsername ?? "Anonymous Stranger"}
                  </p>
                  <p className="text-xs text-muted">
                    {match?.tier === "deep" ? "Deep Dive" : "Quick Match"}
                  </p>
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
                  : "border-brand/30 text-brand-light",
              ].join(" ")}
            >
              {match.tier === "deep" ? "Deep Dive" : "Quick Chat"}
            </span>
            <span className="text-xs text-muted">
              {(match.scenario_tags ?? [])
                .map((t: string) => t.replace(/_/g, " "))
                .join(" \u2022 ")}
            </span>
          </div>

          {/* right */}
          <div className="flex items-center gap-4 shrink-0">
            {/* pool */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm text-brand-light font-medium">
                &#9670; {match.shared_pool.toLocaleString()} tokens
              </span>
              <div className="w-24 h-1 rounded-full bg-white/10 mt-1">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-crimson-500 transition-all duration-500"
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
                className="text-xs bg-white/5 border border-white/10 text-muted-strong px-3 py-1.5 rounded-lg hover:bg-white/10 hover:text-foreground-dim transition-all"
              >
                &#x1F5BC;&#xFE0F; Generate
              </button>
            )}

            {/* Report — deliberately NOT gated on match.status. A scene
                that just ended is exactly when someone reaches for this,
                and gating it on "active" would mean the abuse that ended
                the scene is the abuse you cannot report. */}
            <button
              type="button"
              onClick={() => {
                setReportDone(false);
                setReportMsg("");
                setShowReport(true);
              }}
              className="text-xs bg-white/5 border border-white/10 text-muted-strong px-3 py-1.5 rounded-lg hover:bg-white/10 hover:text-foreground-dim transition-all"
              title="Report this conversation"
            >
              Report
            </button>

            {/* Phase 9.6: leave scene — only when match is active */}
            {match.status === "active" && (
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(true)}
                className="text-xs bg-white/5 border border-red-500/20 text-muted-strong px-3 py-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                Leave
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
          isAiMatch={match.is_ai_match}
          onReveal={handleReveal}
          onMoveOn={handleMoveOn}
          onVibeCheckComplete={handleVibeCheckComplete}
        />
      )}

      {/* ── IMAGE MODAL ── */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-40 bg-void-950/80 backdrop-blur-sm flex items-center justify-center p-6"
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
                <p className="text-muted-strong text-sm">Generating scene...</p>
                <div className="flex items-center gap-1.5">
                  <span
                    className="block w-2 h-2 rounded-full bg-brand-light"
                    style={{
                      animation:
                        "typingBounce 1.4s infinite ease-in-out",
                      animationDelay: "0s",
                    }}
                  />
                  <span
                    className="block w-2 h-2 rounded-full bg-brand-light"
                    style={{
                      animation:
                        "typingBounce 1.4s infinite ease-in-out",
                      animationDelay: "0.2s",
                    }}
                  />
                  <span
                    className="block w-2 h-2 rounded-full bg-brand-light"
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
                  className="px-4 py-2 rounded-lg bg-white/10 text-muted-strong text-sm hover:bg-white/20 transition-all"
                >
                  Close
                </button>
              </div>
            ) : (
              <p className="text-muted text-sm py-8">
                Could not generate image.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── LEAVE SCENE CONFIRMATION ── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-40 bg-void-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-light text-white mb-2">
              Leave this scene?
            </h2>
            <p className="text-sm text-muted mt-2 mb-6">
              Your shared token pool will be consumed and this match will
              end. Your partner will be notified.
            </p>

            {/* Blocking on the way out, without having to file a report
                first. Not everyone who wants never to see someone again
                wants to write a moderator a paragraph about it. */}
            {partnerId() && (
              <label className="flex items-start gap-3 text-left mb-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={blocked}
                  disabled={blocking || blocked}
                  onChange={handleBlock}
                  className="mt-0.5 accent-red-500"
                />
                <span className="text-sm text-muted-strong">
                  {blocked
                    ? "Blocked. You won't be matched with them again."
                    : "Also block this user — you'll never be matched again. They aren't told."}
                </span>
              </label>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleLeaveScene}
                disabled={leaveLoading}
                className="w-full bg-gradient-to-r from-red-600 to-crimson-600 text-white font-medium py-3 rounded-xl hover:from-red-500 hover:to-crimson-500 active:scale-95 transition-all disabled:opacity-50"
              >
                {leaveLoading ? "Leaving..." : "Yes, leave scene"}
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="text-sm text-muted hover:text-foreground-dim transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORT THIS SCENE ── */}
      {showReport && (
        <div className="fixed inset-0 z-40 bg-void-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8">
            {reportDone ? (
              <div className="text-center">
                <h2 className="text-xl font-light text-white mb-2">
                  Report submitted
                </h2>
                <p className="text-sm text-muted mb-6">
                  A moderator will review the conversation. You can keep
                  chatting, or leave the scene now — the report stands
                  either way.
                </p>
                <div className="flex flex-col gap-3">
                  {partnerId() && (
                    <button
                      type="button"
                      onClick={handleBlock}
                      disabled={blocking || blocked}
                      className="w-full bg-red-500/10 border border-red-500/20 text-danger font-medium py-3 rounded-xl hover:bg-red-500/15 disabled:opacity-60 disabled:hover:bg-red-500/10 transition-all"
                    >
                      {blocked
                        ? "Blocked — you won't be matched again"
                        : blocking
                          ? "Blocking..."
                          : "Also block this user"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowReport(false);
                      setShowLeaveConfirm(true);
                    }}
                    className="w-full bg-white/10 border border-white/10 text-white font-medium py-3 rounded-xl hover:bg-white/15 transition-all"
                  >
                    Leave this scene
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReport(false);
                      setReportDone(false);
                      setReportMsg("");
                    }}
                    className="text-sm text-muted hover:text-foreground-dim transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-light text-white mb-2">
                  Report this scene
                </h2>
                <p className="text-sm text-muted mb-5">
                  The last 100 messages are attached automatically as
                  evidence. Your partner is not told you reported.
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    "Harassment",
                    "Sexual content involving a minor",
                    "Threats or violence",
                    "Asking for personal info",
                    "Spam or scam",
                    "Other",
                  ].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setReportCategory((prev) => (prev === cat ? "" : cat))
                      }
                      className={[
                        "px-3 py-1.5 rounded-full text-xs border transition-all",
                        reportCategory === cat
                          ? "bg-red-500/20 border-red-500/40 text-danger"
                          : "bg-white/5 border-white/10 text-muted-strong hover:border-white/20",
                      ].join(" ")}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <label htmlFor="report-detail" className="sr-only">
                  What happened
                </label>
                <textarea
                  id="report-detail"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="What happened? (optional if you picked a reason above)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/40 transition-all resize-none"
                />

                {reportMsg && (
                  <p className="mt-3 text-sm text-danger">{reportMsg}</p>
                )}

                <div className="flex flex-col gap-3 mt-5">
                  <button
                    type="button"
                    onClick={handleReport}
                    disabled={reporting}
                className="w-full bg-gradient-to-r from-red-600 to-crimson-600 text-white font-medium py-3 rounded-xl hover:from-red-500 hover:to-crimson-500 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {reporting ? "Submitting..." : "Submit report"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReport(false);
                      setReportMsg("");
                    }}
                    className="text-sm text-muted hover:text-foreground-dim transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
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
