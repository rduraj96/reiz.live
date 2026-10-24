import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncMediaSession } from "@/lib/audio/mediaSession";
import type { Station } from "@/lib/radio/types";

const station = (over: Partial<Station> = {}): Station => ({
  id: "a",
  name: "Groove FM",
  streamUrl: "https://example.com/a",
  homepage: null,
  favicon: "https://example.com/f.png",
  country: "Chile",
  countryCode: "CL",
  language: "spanish",
  tags: ["jazz", "soul"],
  codec: "MP3",
  bitrate: 128,
  ...over,
});

const makeActions = () => ({ play: vi.fn(), pause: vi.fn(), next: vi.fn(), prev: vi.fn() });

describe("syncMediaSession", () => {
  let handlers: Record<string, () => void>;
  let session: { metadata: unknown; playbackState: string; setActionHandler: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    handlers = {};
    session = {
      metadata: null,
      playbackState: "none",
      setActionHandler: vi.fn((name: string, fn: () => void) => {
        handlers[name] = fn;
      }),
    };
    vi.stubGlobal("MediaMetadata", class { constructor(public init: unknown) {} });
    Object.defineProperty(navigator, "mediaSession", { value: session, configurable: true });
  });

  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).mediaSession;
    vi.unstubAllGlobals();
  });

  it("sets metadata from the station with its favicon", () => {
    syncMediaSession(station(), "playing", makeActions());
    expect((session.metadata as { init: unknown }).init).toEqual({
      title: "Groove FM",
      artist: "Chile · jazz",
      album: "REIZDIO",
      artwork: [{ src: "https://example.com/f.png" }],
    });
  });

  it("falls back to the app icon without a favicon", () => {
    syncMediaSession(station({ favicon: null }), "playing", makeActions());
    expect((session.metadata as { init: { artwork: unknown } }).init.artwork).toEqual([
      { src: "/icon-512.png", sizes: "512x512" },
    ]);
  });

  it("omits missing artist parts and clears metadata with no station", () => {
    syncMediaSession(station({ country: "", tags: [] }), "paused", makeActions());
    expect((session.metadata as { init: { artist: string } }).init.artist).toBe("");
    syncMediaSession(null, "idle", makeActions());
    expect(session.metadata).toBeNull();
  });

  it.each([
    ["playing", "playing"],
    ["paused", "paused"],
    ["blocked", "paused"],
    ["loading", "paused"],
  ] as const)("maps %s with a station to %s", (status, state) => {
    syncMediaSession(station(), status, makeActions());
    expect(session.playbackState).toBe(state);
  });

  it.each(["idle", "loading", "error"] as const)("maps %s with no station to none", (status) => {
    syncMediaSession(null, status, makeActions());
    expect(session.playbackState).toBe("none");
  });

  it("wires the four handlers to the latest actions", () => {
    const first = makeActions();
    const latest = makeActions();
    syncMediaSession(station(), "playing", first);
    syncMediaSession(station(), "playing", latest);
    handlers.play();
    handlers.pause();
    handlers.nexttrack();
    handlers.previoustrack();
    expect(latest.play).toHaveBeenCalledOnce();
    expect(latest.pause).toHaveBeenCalledOnce();
    expect(latest.next).toHaveBeenCalledOnce();
    expect(latest.prev).toHaveBeenCalledOnce();
    expect(first.play).not.toHaveBeenCalled();
  });

  it("falls back to the app icon when the favicon makes MediaMetadata throw", () => {
    vi.stubGlobal(
      "MediaMetadata",
      class {
        constructor(public init: { artwork?: { src: string }[] }) {
          if (init.artwork?.some((a) => a.src === "https://")) throw new TypeError("bad artwork");
        }
      },
    );
    expect(() => syncMediaSession(station({ favicon: "https://" }), "playing", makeActions())).not.toThrow();
    expect((session.metadata as { init: { title: string; artwork: unknown } }).init).toMatchObject({
      title: "Groove FM",
      artwork: [{ src: "/icon-512.png", sizes: "512x512" }],
    });
  });

  it("drops artwork when every artwork makes MediaMetadata throw", () => {
    vi.stubGlobal(
      "MediaMetadata",
      class {
        constructor(public init: { artwork?: unknown[] }) {
          if (init.artwork?.length) throw new TypeError("bad artwork");
        }
      },
    );
    expect(() => syncMediaSession(station(), "playing", makeActions())).not.toThrow();
    const init = (session.metadata as { init: { title: string; artwork?: unknown } }).init;
    expect(init.title).toBe("Groove FM");
    expect(init.artwork).toBeUndefined();
  });

  it("keeps wiring the other handlers when one action is unsupported", () => {
    session.setActionHandler.mockImplementation((name: string, fn: () => void) => {
      if (name === "nexttrack") throw new TypeError("unsupported action");
      handlers[name] = fn;
    });
    const actions = makeActions();
    expect(() => syncMediaSession(station(), "playing", actions)).not.toThrow();
    expect(Object.keys(handlers).sort()).toEqual(["pause", "play", "previoustrack"]);
    handlers.previoustrack();
    expect(actions.prev).toHaveBeenCalledOnce();
  });

  it("does not throw without navigator.mediaSession", () => {
    delete (navigator as unknown as Record<string, unknown>).mediaSession;
    expect(() => syncMediaSession(station(), "playing", makeActions())).not.toThrow();
  });
});
