import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required to join a room" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { token } = body as { token?: string };
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("invite_links")
    .select("creator_id, bot_id, expires_at, revoked")
    .eq("token", token)
    .single();

  if (!link) return NextResponse.json({ state: "invalid" }, { status: 404 });
  if (link.revoked) return NextResponse.json({ state: "revoked" }, { status: 410 });
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ state: "expired" }, { status: 410 });
  }

  if (link.creator_id === user.id) {
    return NextResponse.json({ state: "own_link" });
  }

  const { data: existing } = await admin
    .from("matches")
    .select("id")
    .eq("user_a", link.creator_id)
    .eq("user_b", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ state: "matched", matchId: existing[0].id });
  }

  const { data: match, error } = await admin
    .from("matches")
    .insert({
      user_a: link.creator_id,
      user_b: user.id,
      is_ai_match: false,
      status: "active",
      tier: "quick",
      scenario_tags: [],
      shared_pool: 2000,
      character_ids: link.bot_id ? [link.bot_id] : [],
    })
    .select("id")
    .single();

  if (error || !match) return NextResponse.json({ error: "Could not enter the room" }, { status: 500 });

  return NextResponse.json({ state: "matched", matchId: match.id });
}
