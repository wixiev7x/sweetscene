import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { expireOldEntries, findAndCreateMatches } from "@/lib/matchmaking-server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign up to start matchmaking" }, { status: 401 });

  await expireOldEntries();

  const body = await req.json();
  const { kink_tags = [], mode = "quick", preferred_gender } = body as {
    kink_tags?: string[];
    mode?: string;
    preferred_gender?: string | null;
  };

  const genderPref =
    preferred_gender === "male" || preferred_gender === "female" || preferred_gender === "other"
      ? preferred_gender
      : null;

  const admin = createAdminClient();
  await admin
    .from("matchmaking_queue")
    .update({ status: "cancelled" })
    .eq("user_id", user.id)
    .eq("status", "waiting");

  const { data, error } = await admin
    .from("matchmaking_queue")
    .insert({ user_id: user.id, kink_tags, mode, status: "waiting", preferred_gender: genderPref })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await findAndCreateMatches();

  return NextResponse.json({ id: data.id });
}
