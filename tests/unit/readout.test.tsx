import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BigName } from "@/components/BigName";
import { Readout } from "@/components/Readout";
import { tunerApi } from "@/components/Tuner";
import type { Station } from "@/lib/radio/types";
import { useDial } from "@/store/dial";
import { usePlayer } from "@/store/player";

const station = (over: Partial<Station> = {}): Station => ({
  id: "h1",
  name: "Deep House FM",
  streamUrl: "https://example.com/h1",
  homepage: null,
  favicon: null,
  country: "Netherlands",
  countryCode: "NL",
  language: "",
  tags: ["house"],
  codec: "MP3",
  bitrate: 128,
  ...over,
});

const freqLine = () => document.querySelector("[data-freq]")!;

let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: reduced })) as unknown as typeof window.matchMedia;
  vi.spyOn(tunerApi, "frequencyOf").mockImplementation((id) => (id === "h1" ? "98.3" : null));
  usePlayer.setState({ current: null, tuning: false, status: "idle" });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Readout", () => {
  it("shows frequency · genre · country and the name", () => {
    usePlayer.setState({ current: station() });
    reduced = true;
    render(<Readout />);
    expect(freqLine()).toHaveTextContent("98.3 · HOUSE · NL");
    expect(screen.getByText("Deep House FM")).toBeInTheDocument();
  });

  it("cycles 8 values 38 ms apart before landing on the real frequency", () => {
    render(<Readout />);
    act(() => usePlayer.setState({ current: station() }));
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      act(() => void vi.advanceTimersByTime(38));
      const text = freqLine().textContent!.split(" · ")[0];
      expect(text).toMatch(/^\d{2,3}\.\d$/);
      seen.push(text);
    }
    expect(seen).toHaveLength(8);
    act(() => void vi.advanceTimersByTime(38));
    expect(freqLine().textContent!.split(" · ")[0]).toBe("98.3");
    act(() => void vi.advanceTimersByTime(500));
    expect(freqLine().textContent!.split(" · ")[0]).toBe("98.3");
  });

  it("lands immediately with reduced motion", () => {
    reduced = true;
    render(<Readout />);
    act(() => usePlayer.setState({ current: station() }));
    expect(freqLine()).toHaveTextContent("98.3 · HOUSE · NL");
  });

  it("omits the frequency for an off-dial station", () => {
    reduced = true;
    usePlayer.setState({ current: station({ id: "x" }) });
    render(<Readout />);
    expect(freqLine().textContent).toBe("HOUSE · NL");
  });

  it("lands on the frequency once the layout provides it, without re-rolling", () => {
    reduced = true;
    const f = vi.spyOn(tunerApi, "frequencyOf").mockReturnValue(null);
    usePlayer.setState({ current: station() });
    render(<Readout />);
    expect(freqLine().textContent).toBe("HOUSE · NL");
    f.mockReturnValue("98.3");
    act(() => useDial.setState({ bands: [...useDial.getState().bands] }));
    expect(freqLine()).toHaveTextContent("98.3 · HOUSE · NL");
  });

  it("shuffle calls tunerApi.shuffle", () => {
    const shuffle = vi.spyOn(tunerApi, "shuffle").mockImplementation(() => {});
    render(<Readout />);
    fireEvent.click(screen.getByRole("button", { name: "Surprise me" }));
    expect(shuffle).toHaveBeenCalledTimes(1);
  });

  it("shows a message with Retry in place of the name", () => {
    const onRetry = vi.fn();
    usePlayer.setState({ current: station() });
    reduced = true;
    render(<Readout message="Couldn't load" onRetry={onRetry} />);
    expect(screen.queryByText("Deep House FM")).not.toBeInTheDocument();
    expect(screen.getByText("Couldn't load")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("BigName", () => {
  it("renders one span per character, aria-hidden, staggered 32 ms", () => {
    const { container } = render(<BigName />);
    act(() => usePlayer.setState({ current: station({ name: "A B" }) }));
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("aria-hidden", "true");
    const spans = root.querySelectorAll("span");
    expect(spans).toHaveLength(3);
    expect(spans[2]).toHaveStyle({ transitionDelay: "64ms" });
  });

  it("uses the smaller size class above 14 characters", () => {
    const { container } = render(<BigName />);
    act(() => usePlayer.setState({ current: station({ name: "Fourteen chars" }) }));
    expect(container.firstElementChild!.className).not.toMatch(/long/);
    act(() => usePlayer.setState({ current: station({ name: "Fifteen chars!!!" }) }));
    expect(container.firstElementChild!.className).toMatch(/long/);
  });

  it("has the out class while tuning", () => {
    const { container } = render(<BigName />);
    act(() => usePlayer.setState({ current: station(), tuning: true }));
    expect(container.firstElementChild!.className).toMatch(/out/);
    act(() => usePlayer.setState({ tuning: false }));
    expect(container.firstElementChild!.className).not.toMatch(/out/);
  });

  it("drops the stagger with reduced motion", () => {
    reduced = true;
    const { container } = render(<BigName />);
    act(() => usePlayer.setState({ current: station({ name: "AB" }) }));
    expect(container.querySelectorAll("span")[1]).toHaveStyle({ transitionDelay: "0ms" });
  });
});
