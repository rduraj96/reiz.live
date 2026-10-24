import { NextResponse, type NextRequest } from "next/server";
import { RadioBrowserError, byTag } from "@/lib/radio/client";

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const genre = params.get("genre");
  if (!genre) return NextResponse.json({ error: "genre is required" }, { status: 400 });
  const language = params.get("language");

  try {
    const stations = await byTag(genre, !language || language === "any" ? null : language);
    return NextResponse.json(stations, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    if (error instanceof RadioBrowserError) {
      return NextResponse.json({ error: "Radio directory unavailable" }, { status: 502 });
    }
    throw error;
  }
}
