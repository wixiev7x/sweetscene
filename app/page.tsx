import type { Metadata } from "next";
import Link from "next/link";
import Feed from "@/components/home/Feed";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { fetchFeed, parseAudience, parseMood, parseSort, viewerCanSeeAdult } from "@/lib/home/feed";

export const metadata: Metadata = {
  title: { absolute: "SweetScene — Anonymous Matchmaking for AI Roleplay" },
  description:
    "Browse AI characters, play solo scenes, or get matched anonymously with a real person for an AI-directed roleplay. Reveal only if you both want to.",
  alternates: { canonical: "/" },
};

export const dynamic = "force-dynamic";

type Continue = { id: string; name: string; avatar_url: string | null };

/** Signed-in only: characters from the viewer's most recent solo scenes. */
async function getContinue(): Promise<Continue[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: sessions } = await supabase
      .from("solo_sessions")
      .select("character_id, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(12);
    const ids = [...new Set((sessions ?? []).map((s) => s.character_id as string))].slice(0, 10);
    if (ids.length === 0) return [];
    const { data: chars } = await createAdminClient()
      .from("characters")
      .select("id, name, avatar_url")
      .in("id", ids)
      .eq("is_hidden", false);
    const byId = new Map((chars ?? []).map((c) => [c.id as string, c as Continue]));
    return ids.map((id) => byId.get(id)).filter((c): c is Continue => !!c);
  } catch {
    return [];
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const audience = parseAudience(sp.a);
  const sort = parseSort(sp.s);
  const mood = parseMood(sp.m);
  const adult = await viewerCanSeeAdult();
  const [initial, recent] = await Promise.all([
    fetchFeed({ audience, sort, mood, offset: 0, adult }),
    getContinue(),
  ]);

  return (
    <div className="min-h-screen bg-background px-4 pb-10 text-foreground sm:px-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="sr-only">SweetScene — AI characters and anonymous roleplay matchmaking</h1>

        {recent.length > 0 && (
          <section aria-label="Continue your scenes" className="pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Continue</p>
            <div className="-mx-4 mt-3 flex gap-4 overflow-x-auto px-4 pb-1 scrollbar-none sm:-mx-6 sm:px-6">
              {recent.map((c) => (
                <Link key={c.id} href={`/play/${c.id}`} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                  <span className="relative h-16 w-16 overflow-hidden rounded-full p-[2px]" style={{ background: "linear-gradient(135deg, var(--brand), var(--accent-candle))" }}>
                    <span className="block h-full w-full overflow-hidden rounded-full bg-surface ring-2 ring-background">
                      {c.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-display text-xl">{c.name.charAt(0)}</span>
                      )}
                    </span>
                  </span>
                  <span className="w-full truncate text-center text-[11px] text-muted-strong">{c.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="pt-2">
          <Feed key={`${audience}-${sort}-${mood ?? ""}`} initial={initial} audience={audience} sort={sort} mood={mood} />
        </div>
      </div>
    </div>
  );
}
