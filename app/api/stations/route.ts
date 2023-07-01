import { NextRequest, NextResponse } from "next/server";
import { RadioBrowserApi } from "radio-browser-api";

export async function GET(request: NextRequest) {
  const appName = "Reiz.live";
  const api = new RadioBrowserApi(appName);
  const params = request.nextUrl.searchParams;

  try {
    const response = await api.searchStations({
      limit: Number(params.get("limit")) || 20,
      language: params.get("language") || "english",
      tag: params.get("tag") || "house",
    });
    return new NextResponse(JSON.stringify(response), { status: 201 });
  } catch (error) {
    return new NextResponse("Failed to fetch data", { status: 500 });
  }
}
