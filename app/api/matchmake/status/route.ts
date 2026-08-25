import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MATCHMAKING_TIMEOUT_MS } from "@/lib/matchmaking";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data, error } = await supabase
    .from("matchmaking_queue")
    .select("status, matched_with_user_id, matched_at, created_at, kink_tags, mode")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const elapsed = Date.now() - new Date(data.created_at).getTime();
  if (data.status === "waiting" && elapsed > MATCHMAKING_TIMEOUT_MS) {
    await supabase.from("matchmaking_queue").update({ status: "timeout" }).eq("id", id);
    return NextResponse.json({ status: "timeout" });
  }

  let queuePosition: number | null = null;
  if (data.status === "waiting") {
    const { count } = await supabase
      .from("matchmaking_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "waiting")
      .lte("created_at", data.created_at);
    queuePosition = count ?? null;
  }

  return NextResponse.json({ ...data, queue_position: queuePosition });
}
