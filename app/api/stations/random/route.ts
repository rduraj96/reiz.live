import { NextResponse, type NextRequest } from "next/server";
import { RadioBrowserError, byTag } from "@/lib/radio/client";
import { playableOnly } from "@/lib/radio/verify";

export async function GET(request: NextRequest) {
  const genre = request.nextUrl.searchParams.get("genre");
  if (!genre) return NextResponse.json({ error: "genre is required" }, { status: 400 });

  try {
    const playable = await playableOnly(await byTag(genre, null));
    if (playable.length === 0) {
      return NextResponse.json({ error: "No playable station found" }, { status: 404 });
    }
    return NextResponse.json(playable[Math.floor(Math.random() * playable.length)]);
  } catch (error) {
    if (error instanceof RadioBrowserError) {
      return NextResponse.json({ error: "Radio directory unavailable" }, { status: 502 });
    }
    throw error;
  }
}
