import { NextResponse } from "next/server";
import { findAndCreateMatches, expireOldEntries } from "@/lib/matchmaking-server";

export async function POST() {
  const expired = await expireOldEntries();
  const matched = await findAndCreateMatches();
  return NextResponse.json({ expired, matched });
}
