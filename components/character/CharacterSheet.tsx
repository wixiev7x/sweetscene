"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FeedCharacter } from "@/lib/home/feed";
import { getCharacterDetails, submitCharacterReview, type CharacterDetails } from "@/lib/actions/character-details";
import { getMySocial, getRecommendations, toggleFavorite, toggleLike } from "@/lib/actions/character-social";
import { useAuthModal } from "@/components/auth/AuthModal";
import HoverCardView from "@/components/hover-card/HoverCardView";
import { resolveCard } from "@/components/hover-card/CardHoverPreview";
import { compact, Portrait, Flames, FlameDefs, HEART } from "./bits";

const STAR = "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z";
const SHARE = "M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v14";

function GlassPill({ active, onClick, label, children }: { active?: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[15px] backdrop-blur-xl transition-all active:scale-95 ${
        active ? "bg-brand/85 text-white" : "bg-black/45 text-white hover:bg-black/60"
      }`}
    >
      {children}
    </button>
  );
}

function Row({ title, items, onOpen }: { title: string; items: FeedCharacter[]; onOpen: (c: FeedCharacter) => void }) {
  if (!items.length) return null;
  return (
    <section className="mt-9">
      <h3 className="text-lg text-foreground">{title}</h3>
      <div className="-mx-6 mt-3 flex snap-x gap-3 overflow-x-auto px-6 pb-2 scrollbar-none sm:-mx-8 sm:px-8">
        {items.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onOpen(r)}
            className="group relative aspect-[3/4.3] w-40 shrink-0 snap-start overflow-hidden rounded-2xl bg-surface text-left"
          >
            <Portrait c={r} sizes="160px" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="truncate text-[15px] text-white">
                {r.name.split(" ")[0]} {r.age ? <span className="text-white/55">{r.age}</span> : null}
              </p>
              {r.tagline && <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-white/70">{r.tagline}</p>}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function CharacterSheet({ c, onClose, onOpen }: { c: FeedCharacter; onClose: () => void; onOpen: (c: FeedCharacter) => void }) {
  const router = useRouter();
  const { openAuth } = useAuthModal();
  const [d, setD] = useState<CharacterDetails | null>(null);
  const [recs, setRecs] = useState<{ byCreator: FeedCharacter[]; similar: FeedCharacter[] }>({ byCreator: [], similar: [] });
  const [social, setSocial] = useState({ liked: false, favorited: false, likes: c.like_count });
  const [mine, setMine] = useState(0);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [more, setMore] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setD(null);
    setMore(false);
    Promise.all([getCharacterDetails(c.id), getRecommendations(c.id), getMySocial(c.id)]).then(([det, rec, soc]) => {
      if (!live) return;
      setD(det);
      setMine(det?.myRating ?? 0);
      setRecs(rec);
      setSocial({ liked: soc.liked, favorited: soc.favorited, likes: c.like_count });
    });
    return () => {
      live = false;
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [c.id, c.like_count, onClose]);

  async function like() {
    const r = await toggleLike(c.id);
    if ("error" in r) return r.error === "auth" && openAuth("signup");
    setSocial((s) => ({ ...s, liked: r.on, likes: Math.max(0, s.likes + (r.on ? 1 : -1)) }));
  }
  async function fav() {
    const r = await toggleFavorite(c.id);
    if ("error" in r) return r.error === "auth" && openAuth("signup");
    setSocial((s) => ({ ...s, favorited: r.on }));
  }
  async function share() {
    const url = `${window.location.origin}/?c=${c.id}`;
    try {
      if (navigator.share) await navigator.share({ title: c.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setMsg("Link copied");
      }
    } catch {}
  }
  async function review() {
    if (!mine) return;
    const r = await submitCharacterReview(c.id, mine, note);
    if ("error" in r) {
      if (/sign in/i.test(r.error)) openAuth("signup");
      else setMsg(r.error);
      return;
    }
    setNote("");
    setMsg("Thank you.");
    setD(await getCharacterDetails(c.id));
  }
  function openChat(e?: React.FormEvent) {
    e?.preventDefault();
    const q = reply.trim() ? `?draft=${encodeURIComponent(reply.trim().slice(0, 500))}` : "";
    router.push(`/play/${c.id}${q}`);
  }

  const story = d?.about || c.short_description;
  const card = resolveCard({ name: c.name, age: c.age, story, greeting: c.first_message, tags: c.tags, hover_card: c.hover_card }, "custom");
  const creator = d?.creator ?? c.creator;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-5" role="dialog" aria-modal="true" aria-label={c.name}>
      <FlameDefs />
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <div
        className="relative flex h-[94dvh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[2rem] bg-[#0b0b0d] shadow-2xl ring-1 ring-white/10 md:grid md:grid-cols-[400px_1fr]"
        style={{ animation: "iosSheetUp .3s var(--ios-ease) both" }}
      >
        {/* Portrait-tinted backdrop */}
        {c.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.avatar_url} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-[.12] blur-3xl" />
        )}

        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        {/* Left column */}
        <aside className="relative hidden flex-col gap-5 overflow-y-auto p-6 scrollbar-none md:flex">
          <div className="group relative aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] shadow-2xl">
            <Portrait c={c} sizes="352px" />
            <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10">
              <GlassPill active={social.liked} onClick={like} label="Like">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={HEART} /></svg>
                {compact(social.likes)}
              </GlassPill>
              <GlassPill active={social.favorited} onClick={fav} label="Favorite">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={STAR} /></svg>
                Save
              </GlassPill>
              <GlassPill onClick={share} label="Share">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={SHARE} /></svg>
              </GlassPill>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-muted">Created by</p>
            <div className="rounded-[1.5rem] bg-white/[.04] p-4 ring-1 ring-white/[.06]">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent-candle text-lg text-white">
                  {creator.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] text-foreground">@{creator}</p>
                  <p className="text-xs text-muted">{compact(c.chat_count)} chats</p>
                </div>
              </div>
              {recs.byCreator.length > 0 && <p className="mt-3 text-sm text-muted-strong">{recs.byCreator.length + 1} characters</p>}
            </div>
          </div>
        </aside>

        {/* Right column */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-6 sm:px-8 md:pt-8">
            {/* Mobile portrait */}
            <div className="group relative -mx-6 -mt-6 mb-5 aspect-[4/5] max-h-[52dvh] overflow-hidden sm:-mx-8 md:hidden">
              <Portrait c={c} sizes="100vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d] via-transparent to-transparent" />
              <div className="absolute inset-x-4 bottom-4 flex gap-2">
                <GlassPill active={social.liked} onClick={like} label="Like">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={HEART} /></svg>
                  {compact(social.likes)}
                </GlassPill>
                <GlassPill active={social.favorited} onClick={fav} label="Favorite">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={STAR} /></svg>
                </GlassPill>
                <GlassPill onClick={share} label="Share">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={SHARE} /></svg>
                </GlassPill>
              </div>
            </div>

            <h2 className="pr-12 font-display text-[clamp(2rem,4vw,3.2rem)] leading-[1.05] text-foreground">
              {c.name}
              {c.age ? <span className="ml-3 text-muted">{c.age}</span> : null}
            </h2>

            {/* Stats */}
            <div className="mt-5 grid grid-cols-3 divide-x divide-white/[.08]">
              <div className="pr-4">
                <p className="text-2xl text-foreground">{compact(c.chat_count)}</p>
                <p className="mt-0.5 text-sm text-muted">Chats</p>
              </div>
              <div className="px-4">
                <p className="text-2xl text-foreground">{compact(social.likes)}</p>
                <p className="mt-0.5 text-sm text-muted">Likes</p>
              </div>
              <div className="pl-4">
                <p className="text-2xl text-foreground">{d?.rating ? d.rating.toFixed(1) : "New"}</p>
                <div className="mt-1"><Flames value={d?.rating ?? 0} size={13} /></div>
              </div>
            </div>

            {/* Tags */}
            {c.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {c.tags.map((t) => (
                  <span key={t} className="rounded-full bg-white/[.06] px-3.5 py-1.5 text-sm text-foreground-dim">{t}</span>
                ))}
              </div>
            )}

            {/* Introduction: creator-designed card */}
            {card && (
              <section className="mt-7">
                <h3 className="mb-3 text-lg text-foreground">Introduction</h3>
                <div className={`relative ${more ? "" : "max-h-[340px] overflow-hidden"}`}>
                  <HoverCardView card={card} />
                  {!more && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0b0b0d] to-transparent" />}
                </div>
                <button type="button" onClick={() => setMore((v) => !v)} className="mt-2 text-sm text-brand-light hover:underline">
                  {more ? "Show less" : "View more"}
                </button>
              </section>
            )}

            {/* Comments */}
            <section className="mt-9">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg text-foreground">What people say {d?.ratingCount ? <span className="text-muted">· {d.ratingCount}</span> : null}</h3>
                <Flames value={mine} size={22} onPick={setMine} />
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 400))}
                  onFocus={() => !mine && setMsg("Pick your flames first")}
                  placeholder="Leave a comment…"
                  className="h-12 min-w-0 flex-1 rounded-full bg-white/[.06] px-5 text-[15px] text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand/50"
                />
                <button type="button" onClick={review} disabled={!mine} className="h-12 shrink-0 rounded-full bg-brand px-6 text-[15px] text-white disabled:opacity-40">Post</button>
              </div>
              {msg && <p className="mt-2 text-xs text-brand-lighter">{msg}</p>}
              {d && d.reviews.length === 0 && <p className="mt-4 text-sm text-muted">No comments yet. Be the first.</p>}
              <ul className="mt-3 divide-y divide-white/[.06]">
                {d?.reviews.map((r, i) => (
                  <li key={i} className="py-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[15px] text-foreground-dim">@{r.name}</span>
                      <Flames value={r.rating} size={12} />
                    </div>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-muted-strong">{r.comment}</p>
                    <p className="mt-1 text-xs text-muted">{new Date(r.created_at).toLocaleDateString()}</p>
                  </li>
                ))}
              </ul>
            </section>

            <Row title={`More from @${creator}`} items={recs.byCreator} onOpen={onOpen} />
            <Row title="You might also like" items={recs.similar} onOpen={onOpen} />
          </div>

          {/* Pinned: their first message as a DM, reply opens the chat */}
          <div className="border-t border-white/[.06] bg-black/60 px-6 py-4 backdrop-blur-xl sm:px-8">
            {c.first_message && (
              <div className="flex items-end gap-2.5">
                <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-surface">
                  {c.avatar_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <p className="line-clamp-3 max-w-[88%] rounded-[1.25rem] rounded-bl-md bg-white/[.08] px-4 py-2.5 text-[15px] leading-relaxed text-foreground-dim">
                  {c.first_message}
                </p>
              </div>
            )}
            <form onSubmit={openChat} className="mt-3 flex items-center gap-2 rounded-full bg-white/[.07] p-1.5 pl-5 ring-1 ring-transparent focus-within:ring-brand/60">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={`Reply to ${c.name.split(" ")[0]}…`}
                className="min-w-0 flex-1 bg-transparent text-[16px] text-foreground placeholder:text-muted focus:outline-none"
              />
              <button type="submit" aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform active:scale-90">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4l17.4-7.5c.8-.3.8-1.5 0-1.8L3.4 3.6c-.7-.3-1.4.4-1.2 1.1L4 11l9 1-9 1-1.8 6.3c-.2.7.5 1.4 1.2 1.1z" /></svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


