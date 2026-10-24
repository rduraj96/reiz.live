import { act, cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { genres } from "@/lib/catalog";
import type { Station } from "@/lib/radio/types";

// Intro keeps module state (introDone): load a fresh copy, with fresh stores, per test.
let Intro: typeof import("@/components/Intro").Intro;
let useDial: typeof import("@/store/dial").useDial;

const tuner = vi.hoisted(() => ({
  glideTo: vi.fn(),
  shuffle: vi.fn(),
  tuneNearest: vi.fn(),
  frequencyOf: vi.fn((): string | null => "88.0"),
  bandLabelOf: vi.fn((): string | null => null),
}));
vi.mock("@/components/Tuner", () => ({ tunerApi: tuner }));

const station = (id: string): Station => ({
  id,
  name: id,
  streamUrl: "https://x/" + id,
  homepage: null,
  favicon: null,
  country: "",
  countryCode: "",
  language: "",
  tags: [],
  codec: "MP3",
  bitrate: 128,
});

beforeEach(async () => {
  vi.resetModules();
  ({ Intro } = await import("@/components/Intro"));
  ({ useDial } = await import("@/store/dial"));
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number,
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  Object.defineProperty(document, "fonts", { value: { ready: Promise.resolve() }, configurable: true });
  Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), finished: Promise.resolve() })) as never;
  tuner.glideTo.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Intro", () => {
  it("under StrictMode still runs to completion and removes the layer (no band ever ready)", async () => {
    const { queryByTestId } = render(
      <StrictMode>
        <Intro />
      </StrictMode>,
    );
    expect(queryByTestId("intro")).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000 + 350 + 850 + 200);
    });
    expect(queryByTestId("intro")).toBeNull();
  });

  it("primes the first station when its band only becomes ready after the reveal (cold load, Retry)", async () => {
    const { queryByTestId } = render(<Intro />);
    expect(queryByTestId("intro")).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000 + 350 + 850 + 200);
    });
    expect(queryByTestId("intro")).toBeNull();
    expect(tuner.glideTo).not.toHaveBeenCalled();
    act(() => useDial.getState().patchBand(genres[0].value, { state: "ready", stations: [station("late")] }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(tuner.glideTo).toHaveBeenCalledTimes(1);
    expect(tuner.glideTo).toHaveBeenCalledWith("late", expect.objectContaining({ prime: true }));
  });
});
