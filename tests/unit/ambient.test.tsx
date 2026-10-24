import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAmbientMode } from "@/hooks/useAmbientMode";
import { useAmbient } from "@/store/ambient";

let fullscreenElement: Element | null = null;
const requestFullscreen = vi.fn(async () => {
  fullscreenElement = document.documentElement;
});
const exitFullscreen = vi.fn(async () => {
  fullscreenElement = null;
});
const release = vi.fn(async () => {});
const request = vi.fn(async () => ({ release }) as unknown as WakeLockSentinel);

beforeEach(() => {
  fullscreenElement = null;
  vi.clearAllMocks();
  useAmbient.setState(useAmbient.getInitialState(), true);
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
  document.documentElement.requestFullscreen = requestFullscreen;
  document.exitFullscreen = exitFullscreen;
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
});
afterEach(cleanup);

const flush = () => act(async () => {});

describe("ambient mode", () => {
  it("goes fullscreen when asked, and leaving fullscreen leaves ambient mode", async () => {
    renderHook(() => useAmbientMode());
    act(() => useAmbient.getState().enter({ fullscreen: true }));
    await flush();
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(useAmbient.getState().ownsFullscreen).toBe(true);

    fullscreenElement = null; // the browser's own Esc
    act(() => document.dispatchEvent(new Event("fullscreenchange")));
    expect(useAmbient.getState().on).toBe(false);
  });

  it("exiting undoes the fullscreen it started, but not someone else's", async () => {
    act(() => useAmbient.getState().enter({ fullscreen: true }));
    await flush();
    act(() => useAmbient.getState().exit());
    expect(exitFullscreen).toHaveBeenCalledTimes(1);

    fullscreenElement = document.documentElement; // already fullscreen before ambient
    act(() => useAmbient.getState().enter({ fullscreen: true }));
    act(() => useAmbient.getState().exit());
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("keeps the screen awake while on, and lets go on exit", async () => {
    renderHook(() => useAmbientMode());
    act(() => useAmbient.getState().enter());
    await flush();
    expect(request).toHaveBeenCalledWith("screen");
    act(() => useAmbient.getState().exit());
    await flush();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
