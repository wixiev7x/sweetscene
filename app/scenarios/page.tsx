import Link from "next/link";
import { viewerCanSeeAdult } from "@/lib/home/feed";
import { visibleScenarios } from "@/lib/scenarios";
import { MOODS, NSFW_MOODS } from "@/lib/home/categories";

const ALL = [...MOODS, ...NSFW_MOODS].map((m) => m.toLowerCase());
function soloMood(vibes: string[]) {
  const hit = vibes.find((v) => ALL.includes(v.toLowerCase()));
  return hit ? [...MOODS, ...NSFW_MOODS].find((m) => m.toLowerCase() === hit.toLowerCase()) : undefined;
}

export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const adult = await viewerCanSeeAdult();
  const list = visibleScenarios(adult);
  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-8 text-foreground sm:px-6 md:pt-10">
      <div className="mx-auto max-w-7xl">
        <h1 className="font-display text-4xl md:text-5xl">Scenarios</h1>
        <p className="mt-2 max-w-xl text-[16px] text-muted-strong">
          Pick a story. We&rsquo;ll find a stranger who wants to play the same one.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <article
              key={s.slug}
              className="group relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-[2rem] p-6 ring-1 ring-white/[.07]"
              style={{ background: `radial-gradient(120% 90% at 20% 110%, ${s.tint}, transparent 70%), radial-gradient(80% 60% at 90% 0%, rgba(255,255,255,.04), transparent), #0b0b0d` }}
            >
              <div className="absolute left-6 right-6 top-6 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
                <span>{s.setting}</span>
                {s.adult && <span className="rounded-full bg-brand px-2 py-0.5 tracking-normal text-white">18+</span>}
              </div>
              <h2 className="font-display text-[28px] leading-tight text-white">{s.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-white/75">{s.hook}</p>
              <div className="mt-3 flex flex-wrap gap-x-3 text-sm text-brand-lighter">
                {s.vibes.map((v) => (
                  <span key={v}>#{v.toLowerCase().replace(/\s+/g, "")}</span>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <Link
                  href={`/matchmake?mode=vibe&tags=${encodeURIComponent(s.vibes.join(","))}&scenario=${s.slug}`}
                  className="flex h-12 flex-1 items-center justify-center rounded-full bg-white text-[15px] text-black transition-transform active:scale-[0.97]"
                >
                  Play with a stranger
                </Link>
                <Link
                  href={soloMood(s.vibes) ? `/?m=${encodeURIComponent(soloMood(s.vibes)!)}` : "/"}
                  className="flex h-12 items-center justify-center rounded-full bg-white/[.08] px-5 text-[15px] text-white hover:bg-white/[.14]"
                >
                  Solo
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
