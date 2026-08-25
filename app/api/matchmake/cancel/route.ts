import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = await req.json().catch(() => ({}));
  const { id } = body as { id?: string };

  const admin = createAdminClient();

  if (id) {
    await admin.from("matchmaking_queue").update({ status: "cancelled" }).eq("id", id);
  } else if (user) {
    await admin
      .from("matchmaking_queue")
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
      .eq("status", "waiting");
  }

  return NextResponse.json({ ok: true });
}
