import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StationPanel } from "@/components/StationPanel";
import { addRecent } from "@/lib/library/recents";
import type { Station } from "@/lib/radio/types";
import { usePlayer } from "@/store/player";

const togglePlay = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useEngineBridge", () => ({ togglePlay }));

const st = (id: string): Station => ({
  id,
  name: `Station ${id}`,
  streamUrl: `https://example.com/${id}`,
  homepage: null,
  favicon: null,
  country: "Germany",
  countryCode: "DE",
  language: "",
  tags: [],
  codec: "MP3",
  bitrate: 128,
});

const pickRecent = (name: string) =>
  act(() => void fireEvent.click(screen.getByRole("button", { name: new RegExp(name) })));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })));
  togglePlay.mockClear();
  usePlayer.setState(usePlayer.getInitialState(), true);
  addRecent(st("b"));
  addRecent(st("a"));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StationPanel pick", () => {
  it("after a load failed (idle, loaded current, not primed) a pick plays instead of priming", () => {
    // reportFailure's end state when the list changed since the station loaded.
    usePlayer.setState({ current: st("a"), status: "idle", primed: false, list: [], panel: { open: true, tab: "recent" } });
    render(<StationPanel />);
    pickRecent("Station b");
    expect(usePlayer.getState()).toMatchObject({ current: { id: "b" }, status: "loading", primed: false });
  });

  it("before anything has played (nothing current) a pick primes", () => {
    usePlayer.setState({ panel: { open: true, tab: "recent" } });
    render(<StationPanel />);
    pickRecent("Station b");
    expect(usePlayer.getState()).toMatchObject({ current: { id: "b" }, status: "blocked", primed: true });
  });

  it("picking the idle current station retries it", () => {
    usePlayer.setState({ current: st("a"), status: "idle", primed: false, list: [], panel: { open: true, tab: "recent" } });
    render(<StationPanel />);
    pickRecent("Station a");
    expect(togglePlay).toHaveBeenCalledTimes(1);
  });
});
