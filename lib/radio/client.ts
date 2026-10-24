import "server-only";
import type { RawStation, Station } from "./types";

const DEFAULT_BASE = "https://de1.api.radio-browser.info";
const TIMEOUT_MS = 8000;
const MIN_COUNTRY_STATIONS = 50;

export class RadioBrowserError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RadioBrowserError";
  }
}

// Read at call time so tests / e2e fixture servers can override it.
const base = () => process.env.RADIO_BROWSER_BASE ?? DEFAULT_BASE;

export function normalize(raw: RawStation): Station {
  return {
    id: raw.stationuuid,
    name: raw.name,
    streamUrl: raw.url_resolved,
    homepage: raw.homepage || null,
    favicon: raw.favicon || null,
    country: raw.country,
    countryCode: raw.countrycode,
    language: raw.language,
    tags: (raw.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    codec: raw.codec,
    bitrate: raw.bitrate,
  };
}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, {
      headers: { "User-Agent": "reiz.live" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new RadioBrowserError("Radio Browser request failed", { cause: err });
  }
  if (!res.ok) {
    throw new RadioBrowserError(`Radio Browser responded ${res.status}`);
  }
  try {
    return (await res.json()) as T;
  } catch (err) {
    throw new RadioBrowserError("Radio Browser returned invalid JSON", {
      cause: err,
    });
  }
}

function searchStations(
  filters: Record<string, string | null>,
  limit: number,
): Promise<Station[]> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  params.set("order", "votes");
  params.set("reverse", "true");
  params.set("hidebroken", "true");
  params.set("limit", String(limit));
  return get<RawStation[]>(`/json/stations/search?${params}`).then((rows) =>
    rows.map(normalize),
  );
}

export function byTag(
  tag: string,
  language: string | null,
  limit = 150,
): Promise<Station[]> {
  return searchStations({ tag, language }, limit);
}

export function search(
  name: string,
  countryCode: string | null,
  limit = 150,
): Promise<Station[]> {
  return searchStations({ name, countrycode: countryCode }, limit);
}

export async function byId(id: string): Promise<Station | null> {
  const rows = await get<RawStation[]>(
    `/json/stations/byuuid/${encodeURIComponent(id)}`,
  );
  return rows.length ? normalize(rows[0]) : null;
}

export async function countries(): Promise<{ code: string; name: string }[]> {
  const rows = await get<
    { name: string; iso_3166_1: string; stationcount: number }[]
  >("/json/countries");
  return rows
    .filter((c) => c.stationcount >= MIN_COUNTRY_STATIONS)
    .map((c) => ({ code: c.iso_3166_1, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
