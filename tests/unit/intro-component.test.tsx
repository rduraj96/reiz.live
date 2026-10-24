import { act, cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Intro } from "@/components/Intro";
import { useDial } from "@/store/dial";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number,
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  Object.defineProperty(document, "fonts", { value: { ready: Promise.resolve() }, configurable: true });
  Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), finished: Promise.resolve() })) as never;
  useDial.setState({ firstBandReady: false });
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
});
