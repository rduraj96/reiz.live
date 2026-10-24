import { NextResponse, connection } from "next/server";
import { RadioBrowserError, countries } from "@/lib/radio/client";

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET() {
  // Request-time only: never prerender (would hit Radio Browser during build and freeze the list).
  await connection();
  try {
    return NextResponse.json(await countries(), { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    if (error instanceof RadioBrowserError) {
      return NextResponse.json({ error: "Radio directory unavailable" }, { status: 502 });
    }
    throw error;
  }
}
