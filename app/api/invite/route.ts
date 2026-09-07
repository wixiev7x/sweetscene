import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required to create invite links" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { botId, expiresIn } = body as { botId?: string; expiresIn?: string };

  if (expiresIn !== "1d" && expiresIn !== "permanent") {
    return NextResponse.json({ error: "Choose a link expiry" }, { status: 400 });
  }

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = expiresIn === "1d" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invite_links")
    .insert({ creator_id: user.id, bot_id: botId ?? null, token, expires_at: expiresAt })
    .select("id, token, expires_at")
    .single();

  if (error || !data) return NextResponse.json({ error: "Could not create the link" }, { status: 500 });

  return NextResponse.json({ token: data.token, expires_at: data.expires_at });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ state: "invalid" }, { status: 400 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("invite_links")
    .select("creator_id, bot_id, token, expires_at, revoked, created_at")
    .eq("token", token)
    .single();

  if (!data) return NextResponse.json({ state: "invalid" });

  if (data.revoked) return NextResponse.json({ state: "revoked" });
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ state: "expired" });
  }

  let creatorName: string | null = null;
  let botName: string | null = null;
  if (data.creator_id) {
    const { data: creator } = await admin
      .from("profiles")
      .select("anonymous_username")
      .eq("id", data.creator_id)
      .single();
    creatorName = creator?.anonymous_username ?? null;
  }
  if (data.bot_id) {
    const { data: bot } = await admin.from("bots").select("name").eq("id", data.bot_id).single();
    botName = bot?.name ?? null;
  }

  return NextResponse.json({
    state: "valid",
    creator: creatorName,
    bot_name: botName,
    expires_at: data.expires_at,
  });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { token } = body as { token?: string };
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("invite_links")
    .select("id, creator_id")
    .eq("token", token)
    .single();

  if (!data) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (data.creator_id !== user.id) {
    return NextResponse.json({ error: "Only the host can revoke this link" }, { status: 403 });
  }

  await admin.from("invite_links").update({ revoked: true }).eq("id", data.id);

  return NextResponse.json({ ok: true });
}
