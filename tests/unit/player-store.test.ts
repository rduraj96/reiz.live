import { beforeEach, describe, expect, it } from "vitest";
import { usePlayer } from "@/store/player";
import type { Station } from "@/lib/radio/types";

const st = (id: string): Station => ({
  id,
  name: id,
  streamUrl: `https://example.com/${id}`,
  homepage: null,
  favicon: null,
  country: "",
  countryCode: "",
  language: "english",
  tags: [],
  codec: "MP3",
  bitrate: 128,
});

const ids = (l: Station[]) => l.map((s) => s.id);

beforeEach(() => {
  usePlayer.setState(usePlayer.getInitialState(), true);
});

describe("player store", () => {
  it("has the documented defaults", () => {
    const s = usePlayer.getState();
    expect(s).toMatchObject({ genre: "house", language: "english", volume: 0.8, status: "idle", muted: false });
  });

  it("select sets current and loading", () => {
    usePlayer.getState().select(st("a"));
    expect(usePlayer.getState().current?.id).toBe("a");
    expect(usePlayer.getState().status).toBe("loading");
  });

  it("next and prev wrap around", () => {
    const { setList, select } = usePlayer.getState();
    setList([st("a"), st("b"), st("c")]);
    select(st("c"));
    usePlayer.getState().next();
    expect(usePlayer.getState().current?.id).toBe("a");
    usePlayer.getState().prev();
    expect(usePlayer.getState().current?.id).toBe("c");
  });

  it("markFailed removes, counts and selects the following station", () => {
    usePlayer.getState().setList([st("a"), st("b"), st("c")]);
    usePlayer.getState().select(st("b"));
    usePlayer.getState().markFailed(st("b"));
    const s = usePlayer.getState();
    expect(ids(s.list)).toEqual(["a", "c"]);
    expect(s.failedInARow).toBe(1);
    expect(s.current?.id).toBe("c");
    expect(s.status).toBe("loading");
  });

  it("markFailed wraps to the first station when the last fails", () => {
    usePlayer.getState().setList([st("a"), st("b")]);
    usePlayer.getState().markFailed(st("b"));
    expect(usePlayer.getState().current?.id).toBe("a");
  });

  it("errors out when the list becomes empty", () => {
    usePlayer.getState().setList([st("a")]);
    usePlayer.getState().select(st("a"));
    usePlayer.getState().markFailed(st("a"));
    const s = usePlayer.getState();
    expect(s.status).toBe("error");
    expect(s.current).toBeNull();
    expect(s.list).toEqual([]);
  });

  it("errors out after 5 failures in a row", () => {
    const list = ["a", "b", "c", "d", "e", "f", "g"].map(st);
    usePlayer.getState().setList(list);
    for (let i = 0; i < 4; i++) {
      usePlayer.getState().markFailed(usePlayer.getState().list[0]);
      expect(usePlayer.getState().status).toBe("loading");
    }
    usePlayer.getState().markFailed(usePlayer.getState().list[0]);
    const s = usePlayer.getState();
    expect(s.failedInARow).toBe(5);
    expect(s.status).toBe("error");
    expect(s.current).toBeNull();
  });

  it("markFailed on a station not in the list changes nothing", () => {
    usePlayer.getState().setList([st("a"), st("b")]);
    usePlayer.getState().select(st("a"));
    usePlayer.getState().markFailed(st("b"));
    const before = usePlayer.getState();
    usePlayer.getState().markFailed(st("b"));
    const after = usePlayer.getState();
    expect(after.failedInARow).toBe(1);
    expect(after.current?.id).toBe(before.current?.id);
    expect(ids(after.list)).toEqual(["a"]);
  });

  it("setList and select reset failedInARow; markFailed does not", () => {
    usePlayer.getState().setList([st("a"), st("b"), st("c"), st("d")]);
    usePlayer.getState().markFailed(st("a"));
    usePlayer.getState().markFailed(st("b"));
    expect(usePlayer.getState().failedInARow).toBe(2);
    usePlayer.getState().select(st("d"));
    expect(usePlayer.getState().failedInARow).toBe(0);
    usePlayer.getState().setList([st("x"), st("y")]);
    usePlayer.getState().markFailed(st("x"));
    expect(usePlayer.getState().failedInARow).toBe(1);
    usePlayer.getState().setList([st("z")]);
    expect(usePlayer.getState().failedInARow).toBe(0);
  });

  it("setStatus(playing) resets failedInARow", () => {
    usePlayer.getState().setList([st("a"), st("b")]);
    usePlayer.getState().markFailed(st("a"));
    expect(usePlayer.getState().failedInARow).toBe(1);
    usePlayer.getState().setStatus("playing");
    expect(usePlayer.getState().failedInARow).toBe(0);
  });

  it("toggleMute, setVolume (clamped), setGenre, setLanguage", () => {
    const s = usePlayer.getState();
    s.toggleMute();
    expect(usePlayer.getState().muted).toBe(true);
    s.setVolume(2);
    expect(usePlayer.getState().volume).toBe(1);
    s.setVolume(-1);
    expect(usePlayer.getState().volume).toBe(0);
    s.setGenre("techno");
    s.setLanguage("german");
    expect(usePlayer.getState()).toMatchObject({ genre: "techno", language: "german" });
  });

  it("setListError sets and clears the list error", () => {
    usePlayer.getState().setListError("Radio directory unavailable");
    expect(usePlayer.getState().listError).toBe("Radio directory unavailable");
    usePlayer.getState().setListError(null);
    expect(usePlayer.getState().listError).toBeNull();
  });

  it("select is a no-op for the current station", () => {
    const { setList, select, setStatus } = usePlayer.getState();
    setList([st("a"), st("b")]);
    select(st("a"));
    setStatus("paused");
    select(st("a"));
    expect(usePlayer.getState().status).toBe("paused");
  });

  it("reportFailure marks a listed station failed", () => {
    const { setList, select, reportFailure } = usePlayer.getState();
    setList([st("a"), st("b")]);
    select(st("a"));
    reportFailure(st("a"));
    expect(usePlayer.getState().current?.id).toBe("b");
    expect(ids(usePlayer.getState().list)).toEqual(["b"]);
  });

  it("reportFailure for a station no longer in the list idles and keeps current", () => {
    const { setList, select, reportFailure } = usePlayer.getState();
    setList([st("a")]);
    select(st("a"));
    setList([st("x"), st("y")]);
    reportFailure(st("a"));
    expect(usePlayer.getState()).toMatchObject({ status: "idle" });
    expect(usePlayer.getState().current?.id).toBe("a");
    expect(ids(usePlayer.getState().list)).toEqual(["x", "y"]);
  });
});
