import "server-only";

// Icecast/Shoutcast streams interleave the current song as ICY metadata when asked with `Icy-MetaData: 1`:
// every `icy-metaint` audio bytes comes one length byte (× 16) and that many bytes of `StreamTitle='…';…`.
// Browsers can't ask for it (the header isn't CORS-safe and `icy-metaint` isn't exposed), so the server reads it.

const TIMEOUT_MS = 6000;
const MAX_BYTES = 256 * 1024;

/** The title in an ICY metadata block, or null when there is none worth showing. */
export function parseStreamTitle(meta: string): string | null {
  const key = "StreamTitle='";
  const start = meta.indexOf(key);
  if (start < 0) return null;
  const from = start + key.length;
  const end = meta.indexOf("';", from);
  const title = meta.slice(from, end < 0 ? undefined : end).replace(/\0+$/, "").trim();
  return title === "" || title === "-" ? null : title;
}

const PRIVATE_V4 = [
  [0, 8],
  [10, 8],
  [127, 8],
  [169 * 256 + 254, 16],
  [172 * 256 + 16, 12],
  [192 * 256 + 168, 16],
] as const;

/** Only plain http(s) to a public host: never loopback, link-local or private addresses (no internal fetches). */
export function isPublicStreamUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  if (host.startsWith("[")) {
    const v6 = host.slice(1, -1);
    if (v6 === "::1" || v6 === "::" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)) return false;
    // IPv4 inside IPv6 (::ffff:a.b.c.d, which URL normalises to ::ffff:hhhh:hhhh) and NAT64 (64:ff9b::/96):
    // judge the embedded IPv4 address.
    const embedded = v6.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (embedded) {
      const hi = parseInt(embedded[1], 16);
      return isPublicV4(hi >> 8, hi & 255);
    }
    return !/^(?:::ffff:|64:ff9b:)/.test(v6);
  }
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  return v4 ? isPublicV4(Number(v4[1]), Number(v4[2])) : true;
}

function isPublicV4(a: number, b: number): boolean {
  for (const [prefix, bits] of PRIVATE_V4) {
    if (bits === 8 ? a === prefix : (a * 256 + b) >> (16 - bits) === prefix >> (16 - bits)) return false;
  }
  return true;
}

/** Redirects followed by hand, each target checked like the first URL: fetch's own following would skip the check. */
const MAX_REDIRECTS = 3;

function decode(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("latin1").decode(bytes);
  }
}

/** Reads the stream just far enough to get its first ICY title; null on no metadata, errors, timeout or the cap. */
export async function readIcyTitle(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number; fetchImpl?: typeof fetch } = {},
): Promise<string | null> {
  const { timeoutMs = TIMEOUT_MS, maxBytes = MAX_BYTES, fetchImpl = fetch } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let target = url;
    let res = await fetchImpl(target, {
      headers: { "Icy-MetaData": "1", "User-Agent": "reiz.live" },
      signal: controller.signal,
      redirect: "manual",
    });
    for (let hops = 0; res.status >= 300 && res.status < 400; hops++) {
      const location = res.headers.get("location");
      void res.body?.cancel();
      if (!location || hops >= MAX_REDIRECTS) return null;
      target = new URL(location, target).toString();
      if (!isPublicStreamUrl(target)) return null;
      res = await fetchImpl(target, {
        headers: { "Icy-MetaData": "1", "User-Agent": "reiz.live" },
        signal: controller.signal,
        redirect: "manual",
      });
    }
    const metaint = Number(res.headers.get("icy-metaint"));
    // The block can be up to 255 × 16 bytes; give up early if it can't fit under the cap.
    if (!res.ok || !res.body || !Number.isInteger(metaint) || metaint <= 0 || metaint + 1 > maxBytes) return null;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let have = 0;
    let need = metaint + 1;
    let length = -1;
    while (have < need) {
      const { done, value } = await reader.read();
      if (done) return null;
      chunks.push(value);
      have += value.length;
      if (have > maxBytes) return null;
      if (length < 0 && have >= metaint + 1) {
        const all = concat(chunks, have);
        length = all[metaint] * 16;
        if (length === 0) return null;
        need = metaint + 1 + length;
        if (need > maxBytes) return null;
      }
    }
    const all = concat(chunks, have);
    return parseStreamTitle(decode(all.subarray(metaint + 1, metaint + 1 + length)));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort(); // stop downloading the stream
  }
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  const out = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
