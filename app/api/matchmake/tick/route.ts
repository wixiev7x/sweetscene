import { NextResponse } from "next/server";
import { findAndCreateMatches, expireOldEntries } from "@/lib/matchmaking-server";
import { isCronAuthorized } from "@/lib/utils/cron-auth";

async function handle(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const expired = await expireOldEntries();
  const matched = await findAndCreateMatches();
  return NextResponse.json({ expired, matched });
}

export const GET = handle;
export const POST = handle;
