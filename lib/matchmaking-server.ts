import "server-only";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { MATCHMAKING_TIMEOUT_MS, type QueueRow } from "@/lib/matchmaking";

export async function findAndCreateMatches(): Promise<number> {
  const admin = createAdminClient();
  const { data: waiting } = await admin
    .from("matchmaking_queue")
    .select("*")
    .eq("status", "waiting")
    .order("created_at", { ascending: true })
    .limit(50);

  if (!waiting || waiting.length < 2) return 0;

  let matched = 0;
  const matchedIds = new Set<string>();

  for (let i = 0; i < waiting.length; i++) {
    if (matchedIds.has(waiting[i].id)) continue;
    for (let j = i + 1; j < waiting.length; j++) {
      if (matchedIds.has(waiting[j].id)) continue;
      const a = waiting[i] as QueueRow;
      const b = waiting[j] as QueueRow;
      const tagsOverlap =
        a.mode === "blind_date" ||
        b.mode === "blind_date" ||
        a.kink_tags.length === 0 ||
        b.kink_tags.length === 0 ||
        a.kink_tags.some((t) => b.kink_tags.includes(t));
      if (tagsOverlap) {
        const tier = a.mode === "blind_date" || b.mode === "blind_date" ? "deep" : "quick";
        const sharedTags = [...new Set([...a.kink_tags, ...b.kink_tags])];

        const { data: matchRow } = await admin
          .from("matches")
          .insert({
            user_a: a.user_id,
            user_b: b.user_id,
            is_ai_match: false,
            status: "active",
            tier,
            scenario_tags: sharedTags,
            shared_pool: tier === "deep" ? 10000 : 2000,
          })
          .select("id")
          .single();

        const matchId = matchRow?.id;

        await admin
          .from("matchmaking_queue")
          .update({ status: "matched", matched_with_user_id: b.user_id, matched_at: new Date().toISOString() })
          .eq("id", a.id);
        await admin
          .from("matchmaking_queue")
          .update({ status: "matched", matched_with_user_id: a.user_id, matched_at: new Date().toISOString() })
          .eq("id", b.id);

        if (matchId) {
          await admin
            .from("matchmaking_queue")
            .update({ match_id: matchId } as never)
            .in("id", [a.id, b.id]);
        }

        matchedIds.add(a.id);
        matchedIds.add(b.id);
        matched++;
        break;
      }
    }
  }
  return matched;
}

export async function expireOldEntries(): Promise<number> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - MATCHMAKING_TIMEOUT_MS).toISOString();
  const { data } = await admin
    .from("matchmaking_queue")
    .update({ status: "timeout" })
    .eq("status", "waiting")
    .lt("created_at", cutoff);
  return (data as unknown[] | null)?.length ?? 0;
}
