import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { shareLinkStation } from "@/lib/radio/cachedStation";

export const alt = "REIZDIO live radio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Satori only renders png/jpeg/gif reliably: inline them, skip anything else. */
async function faviconDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || !["image/png", "image/jpeg", "image/gif"].includes(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > 500_000) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ stationId: string }> }) {
  const { stationId } = await params;
  const [station, font] = await Promise.all([
    shareLinkStation(stationId),
    readFile(path.join(process.cwd(), "public/fonts/PPNeueMontreal-Bold.otf")),
  ]);
  const icon = await faviconDataUrl(station?.favicon ?? null);
  const title = station?.name ?? "live radio";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: 72,
          fontFamily: "Neue",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40, flex: 1 }}>
          {icon && (
            <img src={icon} width={160} height={160} alt="" style={{ borderRadius: 24, objectFit: "contain" }} />
          )}
          <div style={{ fontSize: station && station.name.length > 28 ? 64 : 96, lineHeight: 1.1, display: "flex" }}>
            {station ? title : "REIZDIO — live radio"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40 }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: "#ee2647" }} />
          REIZDIO
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Neue", data: font, weight: 700, style: "normal" }] },
  );
}
