import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { MATCHMAKING_TIMEOUT_MS } from "@/lib/matchmaking";
import { findAndCreateMatches, expireOldEntries } from "@/lib/matchmaking-server";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  /* Ownership check — a queue id is a uuid, but it is still a bearer
   * capability for a row containing matched_with_user_id. Only the
   * account that created the queue entry may poll it. */
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await findAndCreateMatches();
  await expireOldEntries();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("matchmaking_queue")
    .select("status, matched_with_user_id, matched_at, created_at, kink_tags, mode, match_id, user_id")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if ((data as { user_id?: string }).user_id !== user.id) {
    return NextResponse.json({ error: "Not your queue entry" }, { status: 403 });
  }

  const elapsed = Date.now() - new Date(data.created_at).getTime();
  if (data.status === "waiting" && elapsed > MATCHMAKING_TIMEOUT_MS) {
    await admin.from("matchmaking_queue").update({ status: "timeout" }).eq("id", id);
    return NextResponse.json({ status: "timeout", match_id: null });
  }

  let queuePosition: number | null = null;
  if (data.status === "waiting") {
    const { count } = await admin
      .from("matchmaking_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "waiting")
      .lte("created_at", data.created_at);
    queuePosition = count ?? null;
  }

  return NextResponse.json({ ...data, queue_position: queuePosition });
}
