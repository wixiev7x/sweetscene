import Link from "next/link";

type Face = { id: string; avatar_url: string | null; name: string };

/**
 * Big sugarlab-style banner about matchmaking. Deliberately no buttons —
 * the whole card is the doorway to /matchmake.
 */
export default function MatchHero({ faces }: { faces: Face[] }) {
  const [a, b] = faces;
  return (
    <Link
      href="/matchmake"
      aria-label="Matchmake, meet someone anonymously"
      className="group mt-2 grid gap-3 md:grid-cols-[1fr_300px]"
    >
      <div className="relative min-h-[230px] overflow-hidden rounded-[2rem] bg-surface md:min-h-[340px]">
        {a?.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.avatar_url}
            alt=""
            className="absolute inset-y-0 right-0 h-full w-[62%] object-cover object-top opacity-90 transition-transform duration-[1200ms] group-hover:scale-[1.04]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_15%_100%,rgba(225,36,92,0.28),transparent)]" />
        <div className="relative flex h-full max-w-[60%] flex-col justify-end p-6 sm:max-w-[55%] md:p-10">
          <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-foreground-dim backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-light" />
            Anonymous matchmaking
          </span>
          <h1 className="font-display text-[clamp(1.6rem,4vw,3rem)] leading-[1.1] text-foreground">
            Two strangers.
            <br />
            One <span className="gradient-text">scene</span>.
          </h1>
          <p className="mt-3 max-w-sm text-sm text-muted-strong md:text-base">
            Get matched with a real person, play out a story together, reveal only if the chemistry is real.
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden rounded-[2rem] bg-surface md:block">
        {b?.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.avatar_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover blur-[2px] transition-transform duration-[1200ms] group-hover:scale-[1.05]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-brand-light">Someone&rsquo;s waiting</p>
          <p className="mt-1 font-display text-xl text-foreground">Who&rsquo;s behind the mask?</p>
        </div>
      </div>
    </Link>
  );
}
