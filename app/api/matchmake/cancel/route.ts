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
    /* Ownership check — a queue entry can only be cancelled by the
     * account that created it. */
    const { data: row } = await admin
      .from("matchmaking_queue")
      .select("user_id")
      .eq("id", id)
      .single();
    if (!row || !user || (row as { user_id: string }).user_id !== user.id) {
      return NextResponse.json({ error: "Not your queue entry" }, { status: 403 });
    }
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
