import { NextResponse, type NextRequest } from "next/server";
import { RadioBrowserError, byTag } from "@/lib/radio/client";
import { playableOnly } from "@/lib/radio/verify";

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const genre = params.get("genre");
  if (!genre) return NextResponse.json({ error: "genre is required" }, { status: 400 });
  const language = params.get("language");

  try {
    // The dial shows 12 a band: stop checking streams once 24 have passed (room for ones that fail on a device).
    const stations = await playableOnly(
      await byTag(genre, !language || language === "any" ? null : language),
      50,
      24,
    );
    return NextResponse.json(stations, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    if (error instanceof RadioBrowserError) {
      return NextResponse.json({ error: "Radio directory unavailable" }, { status: 502 });
    }
    throw error;
  }
}
