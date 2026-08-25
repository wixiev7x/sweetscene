import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { expireOldEntries } from "@/lib/matchmaking-server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await expireOldEntries();

  const body = await req.json();
  const { kink_tags = [], mode = "quick" } = body as { kink_tags?: string[]; mode?: string };

  await supabase
    .from("matchmaking_queue")
    .update({ status: "cancelled" })
    .eq("user_id", user.id)
    .eq("status", "waiting");

  const { data, error } = await supabase
    .from("matchmaking_queue")
    .insert({ user_id: user.id, kink_tags, mode, status: "waiting" })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
