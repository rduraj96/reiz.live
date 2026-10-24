import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const viz = { setActive: vi.fn(), setTuning: vi.fn(), dispose: vi.fn() };
const createVisualizer = vi.fn();
const createFlatVisualizer = vi.fn();

vi.mock("@/visualizer/scene", () => ({ createVisualizer }));
vi.mock("@/visualizer/flat", () => ({ createFlatVisualizer }));
vi.mock("@/lib/audio/engine", () => ({ getAudioEngine: () => ({ analyser: null }) }));

import { Visualizer } from "@/components/Visualizer";
import { usePlayer } from "@/store/player";
import { useViz } from "@/store/visualizer";

// The component loads the scene with a dynamic import; wait for it to be called.
const mounted = () => act(() => vi.waitFor(() => expect(createVisualizer).toHaveBeenCalled()));

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  usePlayer.setState({ status: "idle", tuning: false });
  localStorage.clear();
  useViz.setState(useViz.getInitialState(), true);
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

  it("swaps in the 2D visualizer when WebGL fails", async () => {
    createVisualizer.mockImplementation(() => {
      throw new Error("no webgl");
    });
    createFlatVisualizer.mockReturnValue(viz);
    render(<Visualizer />);
    await mounted();
    await act(() => vi.waitFor(() => expect(createFlatVisualizer).toHaveBeenCalledTimes(1)));
    expect(useViz.getState().mode).toBe("3d"); // the saved choice is untouched
  });

  it("follows the 2D/3D switch, disposing the old renderer", async () => {
    createVisualizer.mockReturnValue(viz);
    createFlatVisualizer.mockReturnValue({ ...viz, dispose: vi.fn() });
    render(<Visualizer />);
    await mounted();
    act(() => useViz.getState().setMode("2d"));
    await act(() => vi.waitFor(() => expect(createFlatVisualizer).toHaveBeenCalledTimes(1)));
    expect(viz.dispose).toHaveBeenCalledTimes(1);
  });

  it("falls back to a CSS disc and still announces the first frame when no canvas works", async () => {
    createVisualizer.mockImplementation(() => {
      throw new Error("no webgl");
    });
    createFlatVisualizer.mockImplementation(() => {
      throw new Error("no canvas");
    });
    const onFirstFrame = vi.fn();
    window.addEventListener("visualizer-first-frame", onFirstFrame);
    const { findByTestId } = render(<Visualizer />);
    await mounted();

    expect(await findByTestId("visualizer-fallback")).toBeInTheDocument();
    expect(onFirstFrame).toHaveBeenCalledTimes(1);
    window.removeEventListener("visualizer-first-frame", onFirstFrame);
  });
});
