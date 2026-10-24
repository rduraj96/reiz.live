import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const viz = { setActive: vi.fn(), setTuning: vi.fn(), dispose: vi.fn() };
const createVisualizer = vi.fn();

vi.mock("@/visualizer/scene", () => ({ createVisualizer }));
vi.mock("@/lib/audio/engine", () => ({ getAudioEngine: () => ({ analyser: null }) }));

import { Visualizer } from "@/components/Visualizer";
import { usePlayer } from "@/store/player";

// The component loads the scene with a dynamic import; wait for it to be called.
const mounted = () => act(() => vi.waitFor(() => expect(createVisualizer).toHaveBeenCalled()));

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  usePlayer.setState({ status: "idle", tuning: false });
});
afterEach(cleanup);

describe("Visualizer", () => {
  it("drives setActive and setTuning from the player store and disposes on unmount", async () => {
    createVisualizer.mockReturnValue(viz);
    const { unmount } = render(<Visualizer />);
    await mounted();

    expect(createVisualizer).toHaveBeenCalledTimes(1);
    expect(viz.setActive).toHaveBeenLastCalledWith(false);
    expect(viz.setTuning).toHaveBeenLastCalledWith(false);

    act(() => usePlayer.setState({ status: "playing", tuning: true }));
    expect(viz.setActive).toHaveBeenLastCalledWith(true);
    expect(viz.setTuning).toHaveBeenLastCalledWith(true);

    unmount();
    expect(viz.dispose).toHaveBeenCalledTimes(1);
  });

  it("falls back to a CSS disc and still announces the first frame when WebGL fails", async () => {
    createVisualizer.mockImplementation(() => {
      throw new Error("no webgl");
    });
    const onFirstFrame = vi.fn();
    window.addEventListener("visualizer-first-frame", onFirstFrame);
    const { getByTestId } = render(<Visualizer />);
    await mounted();

    expect(getByTestId("visualizer-fallback")).toBeInTheDocument();
    expect(onFirstFrame).toHaveBeenCalledTimes(1);
    window.removeEventListener("visualizer-first-frame", onFirstFrame);
  });
});
