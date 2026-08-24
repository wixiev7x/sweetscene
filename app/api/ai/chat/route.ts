import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, ban_reason, banned_until")
    .eq("id", user.id)
    .single();

  if (profile?.is_banned) {
    return NextResponse.json(
      { error: "You are banned", reason: profile.ban_reason },
      { status: 403 }
    );
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a moment." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const { messages, config } = body as {
    messages: { role: string; content: string }[];
    config?: { maxTokens?: number; temperature?: number; model?: string };
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "Messages array is required" },
      { status: 400 }
    );
  }

  const aiConfig: { maxTokens: number; temperature: number; model?: string } = {
    maxTokens: config?.maxTokens ?? 200,
    temperature: config?.temperature ?? 0.9,
    model: config?.model,
  };

  try {
    const adminClient = createAdminClient();
    const { data: settings } = await adminClient
      .from("app_settings")
      .select("key, value_text, is_secret, category")
      .in("category", ["ai", "ai_secret"]);

    if (settings) {
      const settingsMap = new Map(settings.map((s) => [s.key, s]));

      const modelVal = settingsMap.get("ai_model")?.value_text;
      const tempVal = settingsMap.get("ai_temperature")?.value_text;
      const maxTokensVal = settingsMap.get("ai_max_tokens")?.value_text;

      if (modelVal) aiConfig.model = modelVal;
      if (tempVal) aiConfig.temperature = parseFloat(tempVal);
      if (maxTokensVal) aiConfig.maxTokens = parseInt(maxTokensVal, 10);
    }
  } catch {
    // Fall back to defaults if app_settings read fails
  }

  const { getProvider } = await import("@/lib/ai/index");
  const provider = await getProvider();

  const result = await provider.generate(
    messages as { role: "system" | "user" | "assistant"; content: string }[],
    aiConfig
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ content: result.content });
}
