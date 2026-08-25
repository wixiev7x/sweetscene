import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required to invite friends" }, { status: 401 });

  const body = await req.json();
  const { friendUsername } = body as { friendUsername: string; botId?: string };

  if (!friendUsername || friendUsername.trim().length < 2) {
    return NextResponse.json({ error: "Enter a username (min 2 characters)" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: friend } = await admin
    .from("profiles")
    .select("id, anonymous_username")
    .ilike("anonymous_username", `%${friendUsername.trim()}%`)
    .neq("id", user.id)
    .limit(5);

  if (!friend || friend.length === 0) {
    return NextResponse.json({ error: "No users found with that username" }, { status: 404 });
  }

  return NextResponse.json({ users: friend });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = await req.json();
  const { friendId, botId } = body as { friendId: string; botId?: string };

  if (!friendId) return NextResponse.json({ error: "Friend ID required" }, { status: 400 });

  const admin = createAdminClient();

  const characterIds = botId ? [botId] : [];

  const { data, error } = await admin
    .from("matches")
    .insert({
      user_a: user.id,
      user_b: friendId,
      is_ai_match: false,
      status: "active",
      tier: "quick",
      scenario_tags: [],
      shared_pool: 2000,
      character_ids: characterIds,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ matchId: data.id });
}
