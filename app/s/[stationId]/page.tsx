import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Player } from "@/components/Player";
import { shareLinkStation } from "@/lib/radio/cachedStation";

type Props = { params: Promise<{ stationId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { stationId } = await params;
  const station = await shareLinkStation(stationId);
  if (!station) return { title: "Station not found | REIZDIO" };
  const title = `${station.name} on REIZDIO`;
  const description = `Listen to ${station.name} live on REIZDIO.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "REIZDIO" },
    twitter: { card: "summary_large_image", title, description },
  };
}

async function StationPlayer({ params }: Props) {
  const { stationId } = await params;
  const station = await shareLinkStation(stationId);
  if (!station) notFound();
  return <Player initialStation={station} />;
}

export default function SharedStationPage({ params }: Props) {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <StationPlayer params={params} />
    </Suspense>
  );
}
