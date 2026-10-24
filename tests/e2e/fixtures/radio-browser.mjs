// Minimal Radio Browser stand-in for e2e: the app's server-side byId lookups hit this.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3101;
export const KNOWN_ID = "11111111-aaaa-bbbb-cccc-000000000001";
// The directory answers 500 for this id: share links must degrade to "not found".
const FAIL_ID = "fail-500";

const known = {
  stationuuid: KNOWN_ID,
  name: "Fixture FM",
  url_resolved: `http://localhost:${PORT}/tone.wav`,
  homepage: "",
  favicon: "",
  country: "Germany",
  countrycode: "DE",
  language: "english",
  tags: "house",
  codec: "WAV",
  bitrate: 128,
};

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (pathname === "/tone.wav") {
    res.writeHead(200, { "Content-Type": "audio/wav" });
    res.end(readFileSync(path.join(dir, "tone.wav")));
    return;
  }
  const match = pathname.match(/^\/json\/stations\/byuuid\/(.+)$/);
  if (match && decodeURIComponent(match[1]) === FAIL_ID) {
    res.writeHead(500).end();
    return;
  }
  if (match) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(decodeURIComponent(match[1]) === KNOWN_ID ? [known] : []));
    return;
  }
  res.writeHead(404).end();
}).listen(PORT, () => console.log(`radio-browser fixture on ${PORT}`));
