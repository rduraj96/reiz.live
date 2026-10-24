import { NextResponse, type NextRequest } from "next/server";
import { RadioBrowserError, search } from "@/lib/radio/client";
import { playableOnly } from "@/lib/radio/verify";

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ error: "q must be at least 2 characters" }, { status: 400 });
  }

  try {
    const stations = await playableOnly(await search(q, params.get("country") || null));
    return NextResponse.json(stations, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    if (error instanceof RadioBrowserError) {
      return NextResponse.json({ error: "Radio directory unavailable" }, { status: 502 });
    }
    throw error;
  }
}
