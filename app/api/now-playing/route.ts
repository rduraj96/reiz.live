import { NextResponse, type NextRequest } from "next/server";
import { RadioBrowserError, byId } from "@/lib/radio/client";
import { isPublicStreamUrl, readIcyTitle } from "@/lib/radio/icy";

const CACHE_CONTROL = "public, s-maxage=15, stale-while-revalidate=30";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The song a station is playing, read from its stream's ICY metadata. Takes a station id, never a URL:
 * only stream URLs from the directory are ever fetched.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !UUID.test(id)) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const station = await byId(id);
    if (!station) return NextResponse.json({ error: "Station not found" }, { status: 404 });
    let title = isPublicStreamUrl(station.streamUrl) ? await readIcyTitle(station.streamUrl) : null;
    if (title && title.toLowerCase() === station.name.trim().toLowerCase()) title = null;
    return NextResponse.json({ title }, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    if (error instanceof RadioBrowserError) {
      return NextResponse.json({ error: "Radio directory unavailable" }, { status: 502 });
    }
    throw error;
  }
}
