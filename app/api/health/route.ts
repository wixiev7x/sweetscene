import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      { status: "unreachable", error: "Supabase env vars not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(5000),
    });
    return NextResponse.json(
      { status: "ok", supabase: "reachable", http: res.status },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "unreachable",
        error: err instanceof Error ? err.message : "Supabase unreachable",
      },
      { status: 500 }
    );
  }
}
