import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { expireOldEntries, findAndCreateMatches } from "@/lib/matchmaking-server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userId: string;

  if (user) {
    userId = user.id;
  } else {
    const tempId = req.cookies.get("sweetscene-anon-id")?.value;
    if (tempId && tempId.length === 36) {
      userId = tempId;
    } else {
      userId = crypto.randomUUID();
    }
  }

  await expireOldEntries();

  const body = await req.json();
  const { kink_tags = [], mode = "quick" } = body as { kink_tags?: string[]; mode?: string };

  const admin = createAdminClient();
  await admin
    .from("matchmaking_queue")
    .update({ status: "cancelled" })
    .eq("user_id", userId)
    .eq("status", "waiting");

  const { data, error } = await admin
    .from("matchmaking_queue")
    .insert({ user_id: userId, kink_tags, mode, status: "waiting" })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await findAndCreateMatches();

  const res = NextResponse.json({ id: data.id, user_id: userId });
  if (!user) {
    res.cookies.set("sweetscene-anon-id", userId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
  }
  return res;
}
