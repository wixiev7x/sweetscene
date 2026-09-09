import "server-only";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { MATCHMAKING_TIMEOUT_MS, type QueueRow } from "@/lib/matchmaking";

function genderCompatible(a: QueueRow, b: QueueRow): boolean {
  const pa = a.preferred_gender ?? null;
  const pb = b.preferred_gender ?? null;
  if (!pa || !pb) return true;
  if (pa === "other" || pb === "other") return true;
  return (pa === "male" && pb === "female") || (pa === "female" && pb === "male");
}

export async function findAndCreateMatches(): Promise<number> {
  const admin = createAdminClient();
  const { data: waiting } = await admin
    .from("matchmaking_queue")
    .select("*")
    .eq("status", "waiting")
    .order("created_at", { ascending: true })
    .limit(50);

  if (!waiting || waiting.length < 2) return 0;

  /* Safety parity with the legacy lobby flow: never pair across age
   * cohorts, never pair a banned account. Profiles are read with the
   * service role because queue rows carry no cohort data. */
  const userIds = [...new Set(waiting.map((w) => (w as QueueRow).user_id))];
  const { data: profileRows } = await admin
    .from("profiles")
    .select("id, age_cohort, is_banned")
    .in("id", userIds);
  const cohortOf = new Map(
    (profileRows ?? []).map((p) => [p.id as string, p])
  );

  let matched = 0;
  const matchedIds = new Set<string>();

  for (let i = 0; i < waiting.length; i++) {
    if (matchedIds.has(waiting[i].id)) continue;
    for (let j = i + 1; j < waiting.length; j++) {
      if (matchedIds.has(waiting[j].id)) continue;
      const a = waiting[i] as QueueRow;
      const b = waiting[j] as QueueRow;

      const aP = cohortOf.get(a.user_id);
      const bP = cohortOf.get(b.user_id);
      if (!aP || !bP) continue;
      if (aP.is_banned || bP.is_banned) continue;
      /* Unverified cohort defaults to the minor pool — same safe
       * default as the legacy lobby flow (cohortOf). */
      const cohortA = aP.age_cohort === "adult" ? "adult" : "minor";
      const cohortB = bP.age_cohort === "adult" ? "adult" : "minor";
      if (cohortA !== cohortB) continue;

      if (a.mode === "quick" || b.mode === "quick") {
        if (!genderCompatible(a, b)) continue;
      }
      const tagsOverlap =
        a.mode === "blind_date" ||
        b.mode === "blind_date" ||
        a.kink_tags.length === 0 ||
        b.kink_tags.length === 0 ||
        a.kink_tags.some((t) => b.kink_tags.includes(t));
      if (tagsOverlap) {
        const tier = a.mode === "blind_date" || b.mode === "blind_date" ? "deep" : "quick";
        /* Privacy: only the OVERLAP is stored on the match — each
         * side's remaining picks stay private. Empty for blind/empty
         * queues by construction. */
        const sharedTags = a.kink_tags.filter((t) => b.kink_tags.includes(t));

        const { data: matchRow } = await admin
          .from("matches")
          .insert({
            user_a: a.user_id,
            user_b: b.user_id,
            is_ai_match: false,
            status: "active",
            tier,
            cohort: cohortA,
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
          /* match_id exists in the live schema (verified) but not yet
           * in the generated DB types — narrow cast, no behavior lie. */
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
