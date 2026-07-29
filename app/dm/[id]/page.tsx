"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useMounted } from "@/lib/utils/useMounted";
import { containsBlockedTerm, sanitizeAndScrub } from "@/lib/utils/safety";
import { sendDMMessage, getMatchMessages, decryptMessageContent, reportConversation } from "@/lib/actions/messages";
import { blockUser } from "@/lib/actions/blocks";
import { Spinner } from "@/components/ui";
import ChatBox from "@/components/ChatBox";
import MessageList from "@/components/MessageList";

/* ── local type ── */
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
  status: "active" | "ended" | "revealed";
  user_a: string;
  user_b: string | null;
  is_ai_match: boolean;
  scenario_tags: string[];
  character_ids: string[];
};

type PartnerProfile = {
  anonymous_username: string;
  anonymous_pfp_url: string | null;
};

/**
 * Post-reveal DM room. After both users agree to reveal in the
 * FadeToBlack overlay, they arrive here for a private human-to-human
 * chat. No AI director, no token pool, no scene limits.
 */
export default function DMPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const matchId = params.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [partnerProfile, setPartnerProfile] =
    useState<PartnerProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false);
  const [showReportBox, setShowReportBox] = useState(false);

  /* Blocking, post-reveal. Same silent semantics as in a scene: the
     blocked user is never told, and claim_match will not pair you again. */
  const [blockTargetId, setBlockTargetId] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportMsg, setReportMsg] = useState("");
  const mounted = useMounted();

  const characterNameMap = useRef<Map<string, string>>(new Map());

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

      /* build character name map from DB */
      if (m.character_ids && m.character_ids.length > 0) {
        for (const cid of m.character_ids) {
          const { data: dbChar } = await supabase
            .from("characters")
            .select("name")
            .eq("id", cid)
            .single();
          characterNameMap.current.set(
            cid,
            dbChar?.name ?? "Director"
          );
        }
      }

      /* fetch partner profile */
      const partnerId =
        m.user_a === user.id ? m.user_b : m.user_a;
      if (partnerId) {
        setBlockTargetId(partnerId);
        const { data: pp } = await supabase
          .from("profiles")
          .select("anonymous_username, anonymous_pfp_url")
          .eq("id", partnerId)
          .single();
        if (pp) setPartnerProfile(pp as PartnerProfile);
      }

      /* fetch all messages (decrypted server-side) */
      const msgResult = await getMatchMessages(matchId);

      if (!("error" in msgResult)) {
        const transformed: ChatMessage[] = msgResult.messages.map((msg) => ({
          id: msg.id,
          sender_type: msg.sender_type,
          sender_id: msg.sender_id,
          character_id: msg.character_id,
          character_name: msg.character_id
            ? characterNameMap.current.get(msg.character_id) ?? null
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

  /* ── real-time subscription ── */
  useEffect(() => {
    if (!matchId || !mounted) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`dm:${matchId}`)
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
          const encryptedContent = msg.content as string;
          const isMine = senderId === currentUserId;

          /* Own messages are already added optimistically in handleSend. */
          if (isMine) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msgId)) return prev;
              return [
                ...prev,
                {
                  id: msgId,
                  sender_type: msg.sender_type as "human" | "ai",
                  sender_id: senderId,
                  character_id: (msg.character_id as string) ?? null,
                  character_name: null,
                  content: encryptedContent,
                  created_at: msg.created_at as string,
                  is_mine: true,
                },
              ];
            });
            return;
          }

          /* Decrypt partner messages server-side. */
          decryptMessageContent(matchId, encryptedContent).then(
            (decrypted) => {
              const content =
                "error" in decrypted ? "[unreadable]" : decrypted.content;

              setMessages((prev) => {
                if (prev.some((m) => m.id === msgId)) return prev;
                return [
                  ...prev,
                  {
                    id: msgId,
                    sender_type: msg.sender_type as "human" | "ai",
                    sender_id: senderId,
                    character_id: (msg.character_id as string) ?? null,
                    character_name: null,
                    content,
                    created_at: msg.created_at as string,
                    is_mine: false,
                  },
                ];
              });
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, mounted, currentUserId]);

  /* ── send message ── */
  async function handleSend(text: string) {
    if (sending) return;
    if (!match) return;

    if (containsBlockedTerm(text)) {
      setError("Message blocked.");
      return;
    }

    /* Phase 5a: DMs now pass through sanitizeAndScrub — previously
       DMs sent raw text, bypassing the URL/email/phone redaction and
       the prompt-injection scrubber. */
    const scrubbed = sanitizeAndScrub(text);
    if (!scrubbed.trim()) {
      setError("Empty message.");
      return;
    }

    setSending(true);
    setError("");

    /* Phase 7: send via sendDMMessage (verifies revealed + refuses media).
       DMs cost 0 tokens. */
    let result;
    try {
      result = await sendDMMessage(matchId, scrubbed);
    } catch {
      setError("Network error. Try again.");
      setSending(false);
      return;
    }

    if ("error" in result) {
      setError(result.error);
    } else {
      /* Optimistic display — Realtime will also fire but we deduplicate. */
      const userMsg: ChatMessage = {
        id: result.messageId,
        sender_type: "human",
        sender_id: currentUserId,
        character_id: null,
        character_name: null,
        content: result.content,
        created_at: new Date().toISOString(),
        is_mine: true,
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === userMsg.id)) return prev;
        return [...prev, userMsg];
      });
    }

    setSending(false);
  }

  async function handleBlock() {
    if (!blockTargetId || blocking || blocked) return;
    setBlocking(true);
    const result = await blockUser(blockTargetId);
    setBlocking(false);
    if ("error" in result) {
      setReportMsg(result.error);
      return;
    }
    setBlocked(true);
    setReportMsg("Blocked. You won't be matched again.");
  }

  /* ── Phase 7: report conversation ── */
  async function handleReport() {
    if (!reportReason.trim()) {
      setReportMsg("Please enter a reason.");
      return;
    }
    setReporting(true);
    setReportMsg("");
    const result = await reportConversation(matchId, reportReason.trim());
    setReporting(false);
    if ("error" in result) {
      setReportMsg(result.error);
    } else {
      setReportMsg("Report submitted. Thank you.");
      setShowReportBox(false);
      setReportReason("");
    }
  }

  if (!mounted) return null;

  /* ── loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <Spinner />
        <p className="text-muted text-sm">
          Loading conversation...
        </p>
      </div>
    );
  }

  /* ── access guard: not revealed ── */
  if (match && match.status !== "revealed") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <span className="text-4xl text-yellow-500/50 mb-4">
          &#9888;
        </span>
        <p className="text-muted-strong text-center">
          This conversation hasn&apos;t been revealed yet.
        </p>
        <p className="text-muted-faint text-sm text-center mt-2 max-w-sm">
          Both users must agree to reveal before accessing the DM
          room.
        </p>
        <Link
          href="/lobby"
          className="text-brand-light text-sm hover:text-brand-lighter transition-colors mt-4"
        >
          &larr; Back to Lobby
        </Link>
      </div>
    );
  }

  /* ── access guard: AI match ── */
  if (match && match.is_ai_match) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <span className="text-4xl text-muted/50 mb-4">
          &#x1F916;
        </span>
        <p className="text-muted-strong text-center">
          AI matches don&apos;t have DM rooms.
        </p>
        <p className="text-muted-faint text-sm text-center mt-2 max-w-sm">
          The AI was your partner. There&apos;s no one to DM.
        </p>
        <Link
          href="/lobby"
          className="text-brand-light text-sm hover:text-brand-lighter transition-colors mt-4"
        >
          &larr; Find a Human Match
        </Link>
      </div>
    );
  }

  if (!match || !partnerProfile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-muted text-sm">
          {error || "Match not found."}
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
      {/* background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(88,28,135,0.05)_0%,transparent_50%)]" />

      {/* ── HEADER ── */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md bg-black/60 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* left */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/lobby"
              className="text-sm text-muted hover:text-foreground-dim transition-colors shrink-0"
            >
              &larr; Lobby
            </Link>

            {/* partner avatar */}
            {partnerProfile.anonymous_pfp_url ? (
              <div
                className="w-10 h-10 rounded-full bg-cover bg-center shrink-0"
                style={{
                  backgroundImage: `url(${partnerProfile.anonymous_pfp_url})`,
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shrink-0">
                <span className="text-sm text-white font-bold">
                  {partnerProfile.anonymous_username
                    .charAt(0)
                    .toUpperCase()}
                </span>
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white truncate">
                  {partnerProfile.anonymous_username}
                </p>
                <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand-light border border-brand/20">
                  &#9670; Revealed
                </span>
              </div>
              <p className="text-xs text-muted">
                You both chose to reveal
              </p>
            </div>
          </div>

          {/* right */}
          <div className="flex items-center gap-3 shrink-0">
            <p className="hidden sm:block text-xs text-muted-faint italic">
              No AI &bull; No Token Limit
            </p>
            {/* Phase 7: report conversation button */}
            <button
              type="button"
              onClick={() => setShowReportBox((v) => !v)}
              className="text-xs text-muted hover:text-red-400 transition-colors px-2 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-red-500/5"
            >
              &#9873; Report
            </button>
          </div>
        </div>
      </header>

      {/* ── Phase 7: Report panel ── */}
      {showReportBox && (
        <div className="relative z-10 px-6 py-3 border-b border-white/5 bg-red-500/5">
          <p className="text-xs text-muted-strong mb-2">
            Report this conversation for moderation. The last 100 messages will be
            decrypted and sent to our team.
          </p>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Why are you reporting? (e.g. harassment, doxxing, illegal content)"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground-dim placeholder-muted-faint focus:outline-none focus:ring-1 focus:ring-red-500/40 resize-none"
          />
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={handleReport}
              disabled={reporting}
              className="text-xs bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-all disabled:opacity-50"
            >
              {reporting ? "Submitting..." : "Submit Report"}
            </button>
            {blockTargetId && (
              <button
                type="button"
                onClick={handleBlock}
                disabled={blocking || blocked}
                className="text-xs bg-white/5 border border-white/10 text-muted-strong px-3 py-1.5 rounded-lg hover:bg-white/10 hover:text-foreground-dim transition-all disabled:opacity-50"
              >
                {blocked ? "Blocked" : blocking ? "Blocking..." : "Block user"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowReportBox(false)}
              className="text-xs text-muted-faint hover:text-muted-strong transition-colors"
            >
              Cancel
            </button>
            {reportMsg && (
              <span className="text-xs text-muted italic">{reportMsg}</span>
            )}
          </div>
        </div>
      )}

      {/* ── DECORATIVE BANNER ── */}
      <div className="relative z-0 py-2 px-6 bg-gradient-to-r from-transparent via-brand/5 to-transparent border-b border-white/5">
        <p className="text-xs text-muted italic tracking-wide text-center">
          The fog has lifted. You&apos;re now chatting freely.
        </p>
      </div>

      {/* ── MESSAGE LIST ── */}
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          currentUserId={currentUserId ?? ""}
        />
      </div>

      {/* ── CHAT BOX ── */}
      <ChatBox
        isLocked={sending}
        isEnded={false}
        isRevealed={false}
        errorMessage={error}
        onSend={handleSend}
      />
    </div>
  );
}
