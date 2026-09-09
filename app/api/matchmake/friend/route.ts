import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";

/** Username search for the Invite Room. The room itself is created
 * only when the invitee opens the invite link — never unilaterally. */
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
