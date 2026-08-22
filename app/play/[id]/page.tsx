"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMounted } from "@/lib/utils/useMounted";
import { Spinner } from "@/components/ui";
import ChatBox from "@/components/ChatBox";
import MessageList from "@/components/MessageList";
import {
  getOrCreateSoloSession,
  continueSoloSession,
  appendSoloMessage,
  deleteSoloSession,
  startSoloSession,
  submitCharacterRating,
  regenerateGreeting,
} from "@/lib/actions/solo";
import { createTokenOrder } from "@/lib/actions/billing";
import { TOKEN_PACKAGES } from "@/lib/billing/constants";
import { SOLO_TOKEN_BUDGET as TOKEN_BUDGET } from "@/lib/config/constants";

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

type CharacterInfo = {
  id: string;
  name: string;
  user_prompt: string;
  scenario_tags: string[];
  is_nsfw: boolean;
  alternate_greetings_count: number;
  avatar_url: string | null;
};

type SoloMessage = {
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

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

const RATING_THRESHOLD = 20;

/**
 * Converts server-side SoloMessage[] to the ChatMessage[] shape
 * MessageList expects. Loaded messages get stable IDs (`loaded-N`) so
 * React doesn't remount them on re-render; new messages get UUIDs.
 */
function soloToChatMessages(
  soloMessages: SoloMessage[],
  characterId: string,
  characterName: string
): ChatMessage[] {
  return soloMessages.map((m, i) => ({
    id: `loaded-${i}`,
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
 * Solo AI chat page. One-on-one roleplay with a single AI character.
 * Chat history is persisted in a solo_session (Supabase) so it
 * survives page reloads. The character's first_message opens the
 * scene; alternate_greetings can be regenerated. After 20 messages
 * or an explicit "End Session", a thumbs-up/down rating popup
 * increments the character's connection_score.
 */
export default function PlayPage() {
  const params = useParams<{ id: string }>();
  const characterId = params.id;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiResponding, setAiResponding] = useState(false);
  const [error, setError] = useState("");
  const [tokensUsed, setTokensUsed] = useState(0);
  const [showRating, setShowRating] = useState(false);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [hasRated, setHasRated] = useState(false);
  /* Phase 8A: paywall when out of tokens. */
  const [showPaywall, setShowPaywall] = useState(false);
  const [topUpQty, setTopUpQty] = useState(10000);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const mounted = useMounted();

  /* ── load or resume session on mount ── */
  useEffect(() => {
    async function load() {
      /* Check for ?session= query param (from the "Continue chatting"
         carousel on /characters). If present, resume that specific
         session; otherwise get-or-create the most recent one. */
      const searchParams = new URLSearchParams(window.location.search);
      const sessionParam = searchParams.get("session");

      const result = sessionParam
        ? await continueSoloSession(sessionParam)
        : await getOrCreateSoloSession(characterId);

      if ("error" in result) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setSessionId(result.sessionId);
      setCharacter(result.character);
      setTokensUsed(result.tokensUsed);
      setMessages(
        soloToChatMessages(
          result.messages,
          result.character.id,
          result.character.name
        )
      );
      setLoading(false);
    }

    load();
  }, [characterId]);

  /* ── send a message ── */
  async function handleSend(text: string) {
    if (aiResponding) return;
    if (!character || !sessionId) return;

    if (tokensUsed >= TOKEN_BUDGET) {
      setShowPaywall(true);
      return;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender_type: "human",
      sender_id: "me",
      character_id: null,
      character_name: null,
      content: text,
      created_at: new Date().toISOString(),
      is_mine: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    setAiResponding(true);
    setError("");

    try {
      const result = await appendSoloMessage(sessionId, text);

      if ("error" in result) {
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        /* Server-side token deduction may fail even when the client
           thinks there's budget left (race or concurrent tab). */
        if (result.error.toLowerCase().includes("token")) {
          setShowPaywall(true);
        } else {
          setError(result.error);
        }
        return;
      }

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sender_type: "ai",
        sender_id: null,
        character_id: character.id,
        character_name: character.name,
        content: result.content,
        created_at: new Date().toISOString(),
        is_mine: false,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setTokensUsed((prev) => prev + result.tokensUsed);

      /* Show rating popup after the threshold. messages.length is
         the count before this turn; +2 accounts for user + AI. */
      if (messages.length + 2 >= RATING_THRESHOLD && !hasRated) {
        setShowRating(true);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setError("AI response failed. Try again.");
    } finally {
      setAiResponding(false);
    }
  }

  /* ── clear chat: delete session and start fresh ── */
  async function handleClear() {
    if (!sessionId || !character) return;

    await deleteSoloSession(sessionId);

    const result = await startSoloSession(character.id);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setSessionId(result.sessionId);
    setMessages(
      soloToChatMessages(
        result.messages,
        result.character.id,
        result.character.name
      )
    );
    setTokensUsed(0);
    setHasRated(false);
    setShowRating(false);
    setGreetingIndex(0);
    setError("");
  }

  /* ── regenerate the opening greeting ── */
  async function handleRegenerateGreeting() {
    if (!sessionId || !character) return;

    const nextIndex = greetingIndex + 1;
    const result = await regenerateGreeting(sessionId, nextIndex);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setGreetingIndex(nextIndex);
    const now = new Date().toISOString();

    setMessages((prev) => {
      if (prev.length === 0 || prev[0].sender_type !== "ai") {
        return [
          {
            id: crypto.randomUUID(),
            sender_type: "ai",
            sender_id: null,
            character_id: character.id,
            character_name: character.name,
            content: result.greeting,
            created_at: now,
            is_mine: false,
          },
          ...prev,
        ];
      }
      return prev.map((m, i) =>
        i === 0 ? { ...m, content: result.greeting, created_at: now } : m
      );
    });
  }

  /* ── submit a thumbs-up/down rating ── */
  async function handleRate(liked: boolean) {
    if (!character) return;

    await submitCharacterRating(character.id, liked);
    setHasRated(true);
    setShowRating(false);
  }

  /* ── end session: show the rating popup ── */
  function handleEndSession() {
    if (hasRated) return;
    setShowRating(true);
  }

  /* ── top up tokens: redirect to NOWPayments checkout ── */
  async function handleTopUp() {
    setTopUpLoading(true);
    const result = await createTokenOrder(topUpQty);
    setTopUpLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      window.location.assign(result.invoiceUrl);
    }
  }

  /* ── progress bar ── */
  function budgetPercent(): number {
    const pct = (tokensUsed / TOKEN_BUDGET) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  if (!mounted) return null;

  /* ── loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-void-950 flex flex-col items-center justify-center gap-4">
        <Spinner />
        <p className="text-muted text-sm">Loading character...</p>
      </div>
    );
  }

  /* ── error / not found ── */
  if (!character) {
    return (
      <div className="min-h-screen bg-void-950 flex flex-col items-center justify-center gap-4">
        <p className="text-muted text-sm">
          {error || "Character not found"}
        </p>
        <Link
          href="/characters"
          className="text-sm text-brand-light hover:text-brand-lighter transition-colors"
        >
          &larr; Back to Characters
        </Link>
      </div>
    );
  }

  const gIdx = hashGradient(character.name);
  const [gradFrom, gradTo] = GRADIENTS[gIdx];
  const budgetExhausted = tokensUsed >= TOKEN_BUDGET;
  const hasUserMessages = messages.some((m) => m.sender_type === "human");
  const showRegenerate =
    character.alternate_greetings_count > 0 &&
    !hasUserMessages &&
    !showRating;

  return (
    <div className="h-screen flex flex-col bg-void-950 text-white overflow-hidden">
      {/* background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,45,149,0.08)_0%,transparent_50%)]" />

      {/* ── HEADER ── */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md bg-void-950/60 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* left */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/characters"
              className="text-sm text-muted hover:text-foreground-dim transition-colors shrink-0"
            >
              &larr; Characters
            </Link>

            {character.avatar_url ? (
              <div
                className="w-10 h-10 rounded-full bg-cover bg-center shrink-0"
                style={{ backgroundImage: `url(${character.avatar_url})` }}
              />
            ) : (
              <div
                className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradFrom} ${gradTo} flex items-center justify-center shrink-0`}
              >
                <span className="text-base text-white font-bold">
                  {character.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {character.name}
              </p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {character.scenario_tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted capitalize"
                  >
                    {tag.replace(/_/g, " ")}
                  </span>
                ))}
                {character.is_nsfw && (
                  <span className="text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                    NSFW
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* right */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm text-brand-light font-medium">
                &#9670; {tokensUsed.toLocaleString()} /{" "}
                {TOKEN_BUDGET.toLocaleString()}
              </span>
              <div className="w-24 h-1 rounded-full bg-white/10 mt-1">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-crimson-500 transition-all duration-500"
                  style={{ width: `${budgetPercent()}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEndSession}
                disabled={hasRated || messages.length === 0}
                className="text-xs text-muted hover:text-foreground-dim px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                End Session
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-muted hover:text-foreground-dim px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── MESSAGE AREA ── */}
      <div className="flex-1 overflow-hidden relative">
        {messages.length === 0 && !loading && !error ? (
          /* info banner */
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-md mx-auto text-center">
              {character.avatar_url ? (
                <div
                  className="w-20 h-20 mx-auto rounded-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${character.avatar_url})` }}
                />
              ) : (
                <div
                  className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${gradFrom} ${gradTo} flex items-center justify-center`}
                >
                  <span className="text-2xl text-white font-bold">
                    {character.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <h2 className="text-2xl font-light text-white mt-4">
                {character.name}
              </h2>
              <p className="text-sm text-muted mt-2 max-w-sm mx-auto leading-relaxed">
                {character.user_prompt}
              </p>
              <p className="text-xs text-muted-faint mt-6 italic">
                Start chatting with {character.name}. This is a private
                practice session — your history is saved.
              </p>
              <span className="block text-2xl text-brand/30 mt-4">
                &darr;
              </span>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} currentUserId="me" />
        )}
      </div>

      {/* ── REGENERATE GREETING BAR ── */}
      {showRegenerate && (
        <div className="relative z-5 py-2 px-6 text-center border-t border-white/5">
          <button
            type="button"
            onClick={handleRegenerateGreeting}
            className="text-xs text-brand-light hover:text-brand-lighter px-3 py-1.5 rounded-lg border border-brand/20 bg-brand/5 hover:bg-brand/10 transition-all"
          >
            &#x1F504; Regenerate greeting
          </button>
        </div>
      )}

      {/* ── RATING POPUP ── */}
      {showRating && (
        <div className="relative z-10 py-3 px-6 bg-gradient-to-t from-black/90 to-transparent">
          <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-sm text-foreground-dim mb-3">
              Did this character feel alive?
            </p>
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => handleRate(true)}
                className="text-3xl hover:scale-110 transition-transform"
                aria-label="Thumbs up"
              >
                &#x1F44D;
              </button>
              <button
                type="button"
                onClick={() => handleRate(false)}
                className="text-3xl hover:scale-110 transition-transform"
                aria-label="Thumbs down"
              >
                &#x1F44E;
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowRating(false)}
              className="text-xs text-muted-faint hover:text-muted-strong mt-2 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* ── PAYWALL MODAL ── */}
      {showPaywall && (
        <div className="fixed inset-0 z-40 bg-void-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <span className="block text-4xl mb-4">&#x1F4B0;</span>
            <h2 className="text-xl font-light text-white">
              You&apos;re out of tokens
            </h2>
            <p className="text-sm text-muted mt-2">
              Top up to keep chatting with {character.name}.
            </p>

            {/* Top Up controls */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-center gap-3">
                <label className="text-sm text-muted-strong">Tokens:</label>
                <select
                  value={topUpQty}
                  onChange={(e) => setTopUpQty(Number(e.target.value))}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                >
                  {TOKEN_PACKAGES.map((pkg) => (
                    <option key={pkg.id} value={pkg.tokens}>
                      {pkg.tokens.toLocaleString()} — ${pkg.priceUsd}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleTopUp}
                disabled={topUpLoading}
                className="w-full bg-gradient-to-r from-brand-dark to-crimson-600 text-white font-medium py-3 rounded-xl hover:from-brand hover:to-crimson-500 active:scale-95 transition-all disabled:opacity-50"
              >
                {topUpLoading ? "Loading..." : "Top Up \u2192"}
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 mt-6">
              <Link
                href="/characters"
                className="text-sm text-muted hover:text-foreground-dim transition-colors"
              >
                Back to Characters
              </Link>
              <button
                type="button"
                onClick={() => setShowPaywall(false)}
                className="text-sm text-muted hover:text-foreground-dim transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHAT BOX ── */}
      <ChatBox
        isLocked={aiResponding}
        isEnded={budgetExhausted}
        isRevealed={false}
        errorMessage={error}
        onSend={handleSend}
      />
    </div>
  );
}
