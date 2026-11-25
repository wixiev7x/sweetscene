import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { createClient } from "@/lib/supabase/server";
import { POINTS } from "@/lib/community/points";

export const dynamic = "force-dynamic";

type Row = { rank: number; user_id: string; username: string; avatar_url: string | null; points: number };
type Creator = { user_id: string; username: string; avatar_url: string | null; characters: number; chats: number; likes: number };
type Confession = { id: string; text: string; mood: string | null; likes: number | null; created_at: string };

const PRIZES = [
  { place: "#1", prize: "1 month of Flame" },
  { place: "#2–3", prize: "1 month of Ember" },
  { place: "#4–10", prize: "20,000 tokens" },
];

/** Whole days until the Monday 00:00 UTC reset. */
function daysUntilReset(now: Date): number {
  const days = (8 - now.getUTCDay()) % 7 || 7;
  const reset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days);
  return Math.max(1, Math.ceil((reset - now.getTime()) / 864e5));
}

function k(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
}

function Avatar({ url, name, size = 48 }: { url: string | null; name: string; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent-candle text-white" style={{ width: size, height: size, fontSize: size / 2.6 }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default async function CommunityPage() {
  const admin = createAdminClient();
  const [{ data: board }, { data: creators }, { data: confessions }] = await Promise.all([
    admin.rpc("weekly_leaderboard", { p_limit: 50 } as never),
    admin.rpc("top_creators", { p_limit: 12 } as never),
    admin.from("confessions").select("id, text, mood, likes, created_at").order("created_at", { ascending: false }).limit(6),
  ]);
  const rows = (board ?? []) as Row[];
  let me: string | null = null;
  try {
    me = (await (await createClient()).auth.getUser()).data.user?.id ?? null;
  } catch {}
  const mine = me ? rows.find((r) => r.user_id === me) : undefined;
  const daysLeft = daysUntilReset(new Date());
  const podium = [rows[1], rows[0], rows[2]];

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-8 text-foreground sm:px-6 md:pt-10">
      <div className="mx-auto max-w-6xl">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[2rem] p-7 ring-1 ring-white/[.07] sm:p-10" style={{ background: "radial-gradient(90% 120% at 0% 100%, rgba(225,36,92,.4), transparent 60%), radial-gradient(60% 80% at 100% 0%, rgba(217,179,122,.18), transparent), #0b0b0d" }}>
          <p className="text-sm uppercase tracking-[0.25em] text-brand-light">This week</p>
          <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.4rem)] leading-[1.05]">The most desired</h1>
          <p className="mt-3 max-w-lg text-[16px] text-muted-strong">Play, create and get loved. The top 10 every week win free plans and tokens.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {PRIZES.map((p) => (
              <div key={p.place} className="rounded-2xl bg-black/35 px-4 py-3 backdrop-blur">
                <p className="text-sm text-accent-candle">{p.place}</p>
                <p className="text-[15px] text-white">{p.prize}</p>
              </div>
            ))}
            <div className="rounded-2xl bg-black/35 px-4 py-3 backdrop-blur">
              <p className="text-sm text-muted">Resets in</p>
              <p className="text-[15px] text-white">{daysLeft} day{daysLeft === 1 ? "" : "s"}</p>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* Leaderboard */}
          <section>
            <h2 className="font-display text-2xl">Leaderboard</h2>
            {rows.length === 0 ? (
              <p className="mt-4 rounded-[1.5rem] bg-white/[.03] p-6 text-muted-strong ring-1 ring-white/[.06]">No one has scored yet this week. Be the first.</p>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-3 items-end gap-3">
                  {podium.map((r, i) =>
                    r ? (
                      <div key={r.user_id} className={`flex flex-col items-center rounded-[1.5rem] bg-white/[.03] p-4 text-center ring-1 ${i === 1 ? "pb-8 ring-accent-candle/40" : "ring-white/[.06]"}`}>
                        <span className={`mb-2 text-sm ${i === 1 ? "text-accent-candle" : "text-muted"}`}>#{r.rank}</span>
                        <Avatar url={r.avatar_url} name={r.username} size={i === 1 ? 72 : 56} />
                        <p className="mt-2 w-full truncate text-[15px]">@{r.username}</p>
                        <p className="text-sm text-brand-light">{k(r.points)} pts</p>
                      </div>
                    ) : (
                      <div key={i} />
                    ),
                  )}
                </div>
                <ol className="mt-4 divide-y divide-white/[.06] rounded-[1.5rem] bg-white/[.02] ring-1 ring-white/[.06]">
                  {rows.slice(3).map((r) => (
                    <li key={r.user_id} className={`flex items-center gap-3 px-4 py-3 ${r.user_id === me ? "bg-brand/10" : ""}`}>
                      <span className="w-8 text-sm text-muted">#{r.rank}</span>
                      <Avatar url={r.avatar_url} name={r.username} size={36} />
                      <span className="flex-1 truncate">@{r.username}</span>
                      <span className="text-sm text-foreground-dim">{k(r.points)} pts</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            <div className="mt-4 rounded-[1.5rem] bg-white/[.03] p-5 ring-1 ring-white/[.06]">
              <p className="text-[15px]">{mine ? <>You&rsquo;re <span className="text-brand-light">#{mine.rank}</span> with {mine.points} points</> : "How to earn points"}</p>
              <ul className="mt-2 grid gap-1 text-sm text-muted-strong sm:grid-cols-2">
                <li>Finish a scene with a stranger · +{POINTS.match_completed}</li>
                <li>Someone rates your character · +{POINTS.review_received_per_flame} per flame</li>
                <li>A new chat on your character · +{POINTS.creator_new_chat}</li>
                <li>First chat of the day · +{POINTS.daily_first_chat}</li>
              </ul>
            </div>
          </section>

          {/* Creators */}
          <section>
            <h2 className="font-display text-2xl">Top creators</h2>
            <ol className="mt-5 space-y-2">
              {((creators ?? []) as Creator[]).map((c, i) => (
                <li key={c.user_id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] px-4 py-3 ring-1 ring-white/[.06]">
                  <span className="w-6 text-sm text-muted">{i + 1}</span>
                  <Avatar url={c.avatar_url} name={c.username} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">@{c.username}</span>
                    <span className="text-xs text-muted">{c.characters} characters · {k(c.chats)} chats · {k(c.likes)} likes</span>
                  </span>
                </li>
              ))}
              {(creators ?? []).length === 0 && <p className="text-muted-strong">Create a character to appear here.</p>}
            </ol>
          </section>
        </div>

        {/* Confessions */}
        <section className="mt-12">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl">Confessions</h2>
            <Link href="/confessions" className="text-sm text-brand-light hover:underline">See all</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {((confessions ?? []) as Confession[]).map((c) => (
              <article key={c.id} className="rounded-[1.5rem] bg-white/[.03] p-5 ring-1 ring-white/[.06]">
                {c.mood && <p className="text-xs uppercase tracking-[0.18em] text-brand-light">{c.mood}</p>}
                <p className="mt-2 line-clamp-5 text-[15px] leading-relaxed text-foreground-dim">&ldquo;{c.text}&rdquo;</p>
                <p className="mt-3 text-xs text-muted">♥ {c.likes ?? 0}</p>
              </article>
            ))}
          </div>
        </section>

        {/* More */}
        <section className="mt-12 grid gap-3 sm:grid-cols-2">
          {[
            { href: "/bounties", t: "Bounty board", d: "Post a scene you want played, or answer someone else's." },
            { href: "/events", t: "Events", d: "Themed nights and blind-date countdowns." },
          ].map((x) => (
            <Link key={x.href} href={x.href} className="group rounded-[1.5rem] bg-white/[.03] p-6 ring-1 ring-white/[.06] transition-colors hover:ring-brand/40">
              <p className="text-[17px]">{x.t} <span className="text-muted transition-transform group-hover:translate-x-1">→</span></p>
              <p className="mt-1 text-sm text-muted-strong">{x.d}</p>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
