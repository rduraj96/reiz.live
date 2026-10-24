import { NextResponse, type NextRequest } from "next/server";
import { RadioBrowserError, byId } from "@/lib/radio/client";

// Not verified here: verification happens at play time, the share page only needs metadata.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const station = await byId(id);
    if (!station) return NextResponse.json({ error: "Station not found" }, { status: 404 });
    return NextResponse.json(station);
  } catch (error) {
    if (error instanceof RadioBrowserError) {
      return NextResponse.json({ error: "Radio directory unavailable" }, { status: 502 });
    }
    throw error;
  }
}
