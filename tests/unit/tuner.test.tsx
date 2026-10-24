import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { Tuner, tunerApi } from "@/components/Tuner";
import type { DialBand } from "@/lib/dial/layout";
import type { Station } from "@/lib/radio/types";
import { useDial } from "@/store/dial";
import { usePlayer } from "@/store/player";

const st = (id: string, name = id.toUpperCase()): Station => ({
  id,
  name,
  streamUrl: `https://example.com/${id}`,
  homepage: null,
  favicon: null,
  country: "",
  countryCode: "",
  language: "",
  tags: [],
  codec: "MP3",
  bitrate: 128,
});

const house = [st("h1"), st("h2"), st("h3")];
const techno = [st("t1"), st("t2")];
const jazz = Array.from({ length: 12 }, (_, i) => st(`j${i}`));

const band = (genre: string, label: string, stations: Station[], state: DialBand["state"] = "ready"): DialBand => ({
  genre,
  label,
  state,
  stations,
});

const loadedBands = (): DialBand[] => [
  band("house", "House", house),
  band("dance", "Dance", [], "empty"),
  band("techno", "Techno", techno),
  band("jazz", "Jazz", jazz),
];

// The store's real actions, captured before any test swaps in spies.
const real = usePlayer.getState();
let log: string[];
type Actions = typeof real;
let spies: {
  select: Mock<Actions["select"]>;
  setList: Mock<Actions["setList"]>;
  setTuning: Mock<Actions["setTuning"]>;
  prime: Mock<Actions["prime"]>;
};

/** Run frames/timers long enough for any glide to settle. */
const settle = () => act(() => vi.advanceTimersByTime(3000));
const dial = () => screen.getByRole("slider");
const key = (k: string) => act(() => void fireEvent.keyDown(dial(), { key: k }));
const nearId = () => document.querySelector("[data-station-id].near")?.getAttribute("data-station-id");

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number,
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;

  usePlayer.setState({ current: null, list: [], primed: false, tuning: false, status: "idle" });
  log = [];
  const wrap = <F extends (...a: never[]) => void>(name: string, fn: F) =>
    vi.fn<F>(((...a: Parameters<F>) => {
      log.push(name);
      fn(...a);
    }) as F);
  spies = {
    select: wrap("select", real.select),
    setList: wrap("setList", real.setList),
    setTuning: wrap("setTuning", real.setTuning),
    prime: wrap("prime", real.prime),
  };
  usePlayer.setState(spies);
  useDial.setState({ bands: loadedBands(), needleGenre: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Tuner", () => {
  it("is a slider announcing the station and genre under the needle", () => {
    render(<Tuner />);
    expect(dial()).toHaveAttribute("aria-valuetext", "H1, House");
    expect(nearId()).toBe("h1");
    expect(useDial.getState().needleGenre).toBe("house");
  });

  it("ArrowRight tunes, then sets the dial queue, selects the next station once and ends tuning", () => {
    render(<Tuner />);
    key("ArrowRight");
    expect(spies.setTuning).toHaveBeenCalledWith(true);
    expect(spies.select).not.toHaveBeenCalled();

    settle();
    expect(spies.setList).toHaveBeenCalledTimes(1);
    expect(spies.setList.mock.calls[0][0].map((s) => s.id)).toEqual([
      ...house,
      ...techno,
      ...jazz,
    ].map((s) => s.id));
    expect(spies.select).toHaveBeenCalledTimes(1);
    expect(spies.select).toHaveBeenCalledWith(house[1]);
    expect(log).toEqual(["setTuning", "setList", "select", "setTuning"]);
    expect(spies.setTuning).toHaveBeenLastCalledWith(false);
    expect(usePlayer.getState().tuning).toBe(false);
    expect(dial()).toHaveAttribute("aria-valuetext", "H2, House");
    expect(nearId()).toBe("h2");
  });

  it("10 fast ArrowRight presses select only the final station (Review Focus 1)", () => {
    render(<Tuner />);
    for (let i = 0; i < 10; i++) {
      key("ArrowRight");
      act(() => vi.advanceTimersByTime(20));
    }
    expect(spies.select).not.toHaveBeenCalled();
    settle();
    // house(3) + techno(2) + jazz: 10 steps from h1 lands on j5.
    expect(spies.select).toHaveBeenCalledTimes(1);
    expect(spies.select).toHaveBeenCalledWith(jazz[5]);
    expect(nearId()).toBe("j5");
  });

  it("Home and End go to the first and last loaded stations", () => {
    render(<Tuner />);
    key("End");
    settle();
    expect(spies.select).toHaveBeenLastCalledWith(jazz[11]);
    key("Home");
    settle();
    expect(spies.select).toHaveBeenLastCalledWith(house[0]);
    expect(spies.select).toHaveBeenCalledTimes(2);
  });

  it("PageDown jumps to the first station of the next band with stations, skipping empty bands", () => {
    render(<Tuner />);
    key("PageDown");
    settle();
    expect(spies.select).toHaveBeenLastCalledWith(techno[0]);
    key("PageDown");
    settle();
    expect(spies.select).toHaveBeenLastCalledWith(jazz[0]);
    key("PageUp");
    settle();
    expect(spies.select).toHaveBeenLastCalledWith(techno[0]);
  });

  it("with no loaded stations, keys, wheel and shuffle don't throw or select (Review Focus 5)", () => {
    useDial.setState({
      bands: [band("house", "House", [], "idle"), band("dance", "Dance", [], "empty"), band("techno", "Techno", [], "error")],
    });
    render(<Tuner />);
    expect(screen.getByText("No stations")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load")).toBeInTheDocument();
    expect(() => {
      key("ArrowRight");
      key("End");
      key("PageDown");
      act(() => void fireEvent.wheel(dial(), { deltaY: 300 }));
      act(() => tunerApi.shuffle());
      settle();
    }).not.toThrow();
    expect(spies.select).not.toHaveBeenCalled();
    expect(usePlayer.getState().tuning).toBe(false);
  });

  it("wheel scrolls the dial and snaps 140 ms after the last event", () => {
    render(<Tuner />);
    act(() => void fireEvent.wheel(dial(), { deltaY: 70 }));
    expect(spies.setTuning).toHaveBeenCalledWith(true);
    act(() => vi.advanceTimersByTime(100));
    act(() => void fireEvent.wheel(dial(), { deltaY: 70 }));
    act(() => vi.advanceTimersByTime(100));
    expect(spies.select).not.toHaveBeenCalled();
    settle();
    expect(spies.select).toHaveBeenCalledTimes(1);
    expect(spies.select).toHaveBeenCalledWith(house[2]); // offset 140 -> nearest tick at 144
  });

  it("glides to a station set externally without selecting it again", () => {
    render(<Tuner />);
    act(() => usePlayer.setState({ current: techno[1] }));
    settle();
    expect(nearId()).toBe("t2");
    expect(dial()).toHaveAttribute("aria-valuetext", "T2, Techno");
    expect(spies.select).not.toHaveBeenCalled();
    expect(spies.setList).not.toHaveBeenCalled();
  });

  it("shows an off-dial current station as a leading band and drops it once it's on a band", () => {
    const outsider = st("x1", "Outsider");
    usePlayer.setState({ current: outsider });
    render(<Tuner />);
    expect(nearId()).toBe("x1");
    expect(dial()).toHaveAttribute("aria-valuetext", "Outsider");

    // The station appears in a loaded band: the leading band goes away, the needle stays on it.
    act(() => useDial.setState({ bands: [band("house", "House", [outsider, ...house]), ...loadedBands().slice(1)] }));
    expect(document.querySelectorAll('[data-station-id="x1"]')).toHaveLength(1);
    expect(nearId()).toBe("x1");
    expect(dial()).toHaveAttribute("aria-valuetext", "Outsider, House");
  });

  it("keeps the needle in its band when that band resets (language switch) and back on the station once it reloads", () => {
    usePlayer.setState({ current: techno[0] });
    render(<Tuner />);
    expect(nearId()).toBe("t1");

    act(() => useDial.getState().resetForLanguage("german"));
    // The playing station now leads the dial off-band, but the needle stays over Techno so it reloads.
    expect(document.querySelectorAll('[data-station-id="t1"]')).toHaveLength(1);
    expect(useDial.getState().needleGenre).toBe("techno");

    act(() => useDial.getState().patchBand("techno", { state: "ready", stations: techno }));
    expect(nearId()).toBe("t1");
    expect(dial()).toHaveAttribute("aria-valuetext", "T1, Techno");
    expect(spies.select).not.toHaveBeenCalled();
  });

  it("labels the off-dial band from the offDial prop and points the needle genre at the first real band", () => {
    const shared = st("s1", "Shared One");
    render(<Tuner offDial={{ station: shared, label: "Shared" }} />);
    expect(screen.getByText("Shared")).toBeInTheDocument();
    expect(nearId()).toBe("s1");
    expect(dial()).toHaveAttribute("aria-valuetext", "Shared One, Shared");
    expect(useDial.getState().needleGenre).toBe("house");
  });

  it("glideTo with prime primes the station instead of selecting it", () => {
    render(<Tuner />);
    act(() => tunerApi.glideTo("t1", { fromOffset: -700, prime: true }));
    expect(spies.setTuning).toHaveBeenCalledWith(true);
    settle();
    expect(spies.prime).toHaveBeenCalledWith(techno[0]);
    expect(spies.select).not.toHaveBeenCalled();
    expect(spies.setList).not.toHaveBeenCalled();
    expect(log.slice(-2)).toEqual(["prime", "setTuning"]);
    expect(usePlayer.getState().primed).toBe(true);
  });

  it("glideTo's fromOffset is relative to the target station", () => {
    render(<Tuner />);
    act(() => tunerApi.glideTo("t1", { fromOffset: -700, prime: true }));
    // t1 sits at 1848 (house 12 slots + gap + dance 12 slots + gap): the glide starts 700 px left of it, not at x = -700.
    const track = document.querySelector<HTMLElement>("[data-station-id]")!.parentElement!;
    const x = -parseFloat(track.style.transform.replace("translateX(", ""));
    expect(x).toBeGreaterThanOrEqual(1848 - 700);
    expect(x).toBeLessThan(1848);
  });

  it("tuneNearest with nothing current tunes to the station under the needle and plays it", () => {
    render(<Tuner />);
    act(() => tunerApi.tuneNearest());
    settle();
    expect(spies.setList).toHaveBeenCalledTimes(1);
    expect(spies.select).toHaveBeenCalledWith(house[0]);
    expect(usePlayer.getState().primed).toBe(false);
    expect(usePlayer.getState().tuning).toBe(false);
  });

  it("tuneNearest with no loaded stations does nothing", () => {
    useDial.setState({ bands: [band("house", "House", [], "loading")] });
    render(<Tuner />);
    act(() => tunerApi.tuneNearest());
    settle();
    expect(spies.select).not.toHaveBeenCalled();
    expect(spies.setTuning).not.toHaveBeenCalled();
  });

  it("shuffle glides to a random loaded station and selects it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    render(<Tuner />);
    act(() => tunerApi.shuffle());
    settle();
    expect(spies.select).toHaveBeenCalledTimes(1);
    const picked = spies.select.mock.calls[0][0];
    expect([...house, ...techno, ...jazz]).toContain(picked);
  });

  it("unmounting mid-glide, mid-wheel or mid-drag ends tuning", () => {
    const glide = render(<Tuner />);
    key("End");
    act(() => vi.advanceTimersByTime(50));
    expect(usePlayer.getState().tuning).toBe(true);
    glide.unmount();
    expect(usePlayer.getState().tuning).toBe(false);

    const wheel = render(<Tuner />);
    act(() => void fireEvent.wheel(dial(), { deltaY: 70 }));
    expect(usePlayer.getState().tuning).toBe(true);
    wheel.unmount();
    expect(usePlayer.getState().tuning).toBe(false);

    const drag = render(<Tuner />);
    act(() => void fireEvent.pointerDown(dial(), { clientX: 500, pointerId: 1, button: 0 }));
    act(() => void fireEvent.pointerMove(dial(), { clientX: 400, pointerId: 1 }));
    expect(usePlayer.getState().tuning).toBe(true);
    drag.unmount();
    expect(usePlayer.getState().tuning).toBe(false);
    act(() => vi.advanceTimersByTime(3000));
    expect(spies.select).not.toHaveBeenCalled();
  });

  it("ignores keys while dragging and non-primary buttons", () => {
    render(<Tuner />);
    act(() => void fireEvent.pointerDown(dial(), { clientX: 500, pointerId: 1, button: 2 }));
    expect(spies.setTuning).not.toHaveBeenCalled();

    act(() => void fireEvent.pointerDown(dial(), { clientX: 500, pointerId: 1, button: 0 }));
    key("End");
    act(() => vi.advanceTimersByTime(500));
    act(() => void fireEvent.pointerUp(dial(), { clientX: 500, pointerId: 1 }));
    settle();
    expect(spies.select).toHaveBeenCalledTimes(1);
    expect(spies.select).toHaveBeenCalledWith(house[0]);
  });

  it("scales line-mode wheel deltas to pixels", () => {
    render(<Tuner />);
    act(() => void fireEvent.wheel(dial(), { deltaY: 9, deltaMode: 1 })); // 9 lines -> 144 px
    settle();
    expect(spies.select).toHaveBeenCalledWith(house[2]);
  });

  it("drag release glides to the nearest station and selects only it", () => {
    render(<Tuner />);
    const el = dial();
    act(() => void fireEvent.pointerDown(el, { clientX: 500, pointerId: 1 }));
    expect(spies.setTuning).toHaveBeenCalledWith(true);
    for (let x = 500; x >= 200; x -= 10) {
      act(() => vi.advanceTimersByTime(50)); // slow drag: little momentum
      act(() => void fireEvent.pointerMove(el, { clientX: x, pointerId: 1 }));
    }
    act(() => vi.advanceTimersByTime(200));
    act(() => void fireEvent.pointerUp(el, { clientX: 200, pointerId: 1 }));
    expect(spies.select).not.toHaveBeenCalled();
    settle();
    expect(spies.select).toHaveBeenCalledTimes(1);
    // Offset ~300 (+ a little momentum): h3 at 144 is the nearest station; techno starts at 1848.
    expect(spies.select).toHaveBeenCalledWith(house[2]);
    expect(nearId()).toBe("h3");
    expect(usePlayer.getState().tuning).toBe(false);
  });
});
