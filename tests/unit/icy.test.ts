import { describe, expect, it, vi } from "vitest";
import { isPublicStreamUrl, parseStreamTitle, readIcyTitle } from "@/lib/radio/icy";

describe("parseStreamTitle", () => {
  it("reads the title", () => {
    expect(parseStreamTitle("StreamTitle='Daft Punk - Digital Love';StreamUrl='';")).toBe("Daft Punk - Digital Love");
  });
  it("keeps apostrophes inside the title", () => {
    expect(parseStreamTitle("StreamTitle='Guns N' Roses - Don't Cry';")).toBe("Guns N' Roses - Don't Cry");
  });
  it("trims, and treats empty or a lone dash as no title", () => {
    expect(parseStreamTitle("StreamTitle='  Moby - Porcelain  ';")).toBe("Moby - Porcelain");
    expect(parseStreamTitle("StreamTitle='';")).toBeNull();
    expect(parseStreamTitle("StreamTitle=' - ';")).toBeNull();
    expect(parseStreamTitle("StreamUrl='x';")).toBeNull();
  });
});

describe("isPublicStreamUrl", () => {
  it("allows ordinary http(s) hosts", () => {
    expect(isPublicStreamUrl("https://secure.live-streams.nl/main")).toBe(true);
    expect(isPublicStreamUrl("http://8.8.8.8:8000/stream")).toBe(true);
  });
  it.each([
    "ftp://radio.example/stream",
    "http://localhost:8000/",
    "http://radio.local/",
    "http://127.0.0.1/",
    "http://10.1.2.3/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "not a url",
  ])("refuses %s", (url) => {
    expect(isPublicStreamUrl(url)).toBe(false);
  });
});

/** An ICY response: `metaint` audio bytes, then a metadata block holding `meta`, then more audio. */
function icyResponse(meta: string, metaint = 16, extraHeaders: Record<string, string> = {}) {
  const metaBytes = new TextEncoder().encode(meta);
  const blocks = Math.ceil(metaBytes.length / 16);
  const body = new Uint8Array(metaint + 1 + blocks * 16 + 64);
  body[metaint] = blocks;
  body.set(metaBytes, metaint + 1);
  return new Response(body, { headers: { "icy-metaint": String(metaint), ...extraHeaders } });
}

describe("readIcyTitle", () => {
  it("asks for ICY metadata and reads the first title", async () => {
    const fetchImpl = vi.fn(async () => icyResponse("StreamTitle='Air - La Femme d'Argent';"));
    await expect(readIcyTitle("https://radio.example/live", { fetchImpl })).resolves.toBe("Air - La Femme d'Argent");
    const init = (fetchImpl.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(new Headers(init.headers).get("Icy-MetaData")).toBe("1");
  });

  it("is null for a stream without ICY metadata", async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array(100)));
    await expect(readIcyTitle("https://radio.example/live", { fetchImpl })).resolves.toBeNull();
  });

  it("is null when the metadata would be past the read cap", async () => {
    const fetchImpl = vi.fn(async () => icyResponse("StreamTitle='Late';", 4096));
    await expect(readIcyTitle("https://radio.example/live", { fetchImpl, maxBytes: 1024 })).resolves.toBeNull();
  });

  it("is null when the stream errors or times out", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(readIcyTitle("https://radio.example/live", { fetchImpl: failing })).resolves.toBeNull();
    const hanging = vi.fn(
      (_u: unknown, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    await expect(readIcyTitle("https://radio.example/live", { fetchImpl: hanging, timeoutMs: 20 })).resolves.toBeNull();
  });

  it("decodes latin1 metadata", async () => {
    const latin = new Uint8Array([...new TextEncoder().encode("StreamTitle='Bj"), 0xf6, ...new TextEncoder().encode("rk - Joga';")]);
    const body = new Uint8Array(16 + 1 + 32);
    body[16] = 2;
    body.set(latin, 17);
    const fetchImpl = vi.fn(async () => new Response(body, { headers: { "icy-metaint": "16" } }));
    await expect(readIcyTitle("https://radio.example/live", { fetchImpl })).resolves.toBe("Björk - Joga");
  });
});

describe("readIcyTitle and redirects", () => {
  const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });

  it("never follows a redirect to a private address", async () => {
    const fetchImpl = vi.fn(async () => redirect("http://169.254.169.254/latest/meta-data"));
    await expect(readIcyTitle("https://radio.example/live", { fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(((fetchImpl.mock.calls[0] as unknown[])[1] as RequestInit).redirect).toBe("manual");
  });

  it("follows a few redirects between public hosts", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(redirect("/relay"))
      .mockResolvedValueOnce(icyResponse("StreamTitle='Nils Frahm - Says';"));
    await expect(readIcyTitle("https://radio.example/live", { fetchImpl })).resolves.toBe("Nils Frahm - Says");
    expect(fetchImpl.mock.calls[1][0]).toBe("https://radio.example/relay");
  });

  it("gives up after too many redirects", async () => {
    const fetchImpl = vi.fn(async () => redirect("https://radio.example/again"));
    await expect(readIcyTitle("https://radio.example/live", { fetchImpl })).resolves.toBeNull();
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(4);
  });
});

describe("isPublicStreamUrl: IPv6 forms of private IPv4", () => {
  it.each(["http://[::ffff:127.0.0.1]/", "http://[::ffff:a9fe:a9fe]/", "http://[64:ff9b::a00:1]/", "http://[::]/"])(
    "refuses %s",
    (url) => expect(isPublicStreamUrl(url)).toBe(false),
  );
  it("allows a public IPv6 host", () => expect(isPublicStreamUrl("http://[2001:4860:4860::8888]/")).toBe(true));
});
