import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/lobby";

  let next = "/lobby";
  if (
    nextRaw &&
    /^\/[^/\\].*$/.test(nextRaw) &&
    !nextRaw.startsWith("//") &&
    !nextRaw.includes("\\")
  ) {
    next = nextRaw;
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=1`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=1`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=1`);
  }

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("anonymous_username, age_confirmed_at")
      .eq("id", user.id)
      .single();

    if (!profile?.age_confirmed_at) {
      return NextResponse.redirect(`${origin}/age-verify`);
    }

    if (!profile?.anonymous_username) {
      return NextResponse.redirect(`${origin}/complete-profile`);
    }
  } catch {
  }

  try {
    await supabase.rpc("accept_tos");
  } catch {
  }

  return NextResponse.redirect(`${origin}${next}`);
}
