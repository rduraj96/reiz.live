import "@testing-library/jest-dom/vitest";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BigName } from "@/components/BigName";
import { tunerApi } from "@/components/Tuner";
import type { Station } from "@/lib/radio/types";
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

/** Text with the letter spans' non-breaking spaces read as plain spaces. */
const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/ /g, " ");

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false })) as unknown as typeof window.matchMedia;
  vi.spyOn(tunerApi, "frequencyOf").mockImplementation((id) => (id === "h1" ? "98.3" : null));
  vi.spyOn(tunerApi, "bandLabelOf").mockReturnValue(null);
  usePlayer.setState({ current: null, tuning: false, status: "idle" });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("BigName", () => {
  const layers = (container: HTMLElement) => ({
    ticker: container.querySelector<HTMLElement>('[data-variant="ticker"]')!,
    orbit: container.querySelector<HTMLElement>('[data-variant="orbit"]')!,
  });

  it("renders both treatments, aria-hidden, one selected per breakpoint by CSS classes", () => {
    const { container } = render(<BigName />);
    const { ticker, orbit } = layers(container);
    for (const el of [ticker, orbit]) expect(el).toHaveAttribute("aria-hidden", "true");
    // orbit is the base (below 760 px); ticker is the `wide` layer shown at 760 px and up.
    expect(orbit.className).toMatch(/narrow/);
    expect(orbit.className).not.toMatch(/wide/);
    expect(ticker.className).toMatch(/wide/);
    expect(ticker.className).not.toMatch(/narrow/);
  });

  it("ticker: repeats NAME ● FREQ ● along the band", () => {
    const { container } = render(<BigName />);
    act(() => usePlayer.setState({ current: station() }));
    const items = layers(container).ticker.querySelectorAll("[data-ticker-item]");
    expect(items.length).toBeGreaterThanOrEqual(6);
    items.forEach((item) => expect(text(item)).toBe("DEEP HOUSE FM●98.3●"));
  });

  it("ticker: drops the frequency off the dial", () => {
    const { container } = render(<BigName />);
    act(() => usePlayer.setState({ current: station({ id: "x" }) }));
    expect(text(container.querySelector("[data-ticker-item]"))).toBe("DEEP HOUSE FM●");
  });

  it("orbit: name · freq · genre · cc on a ring, frequency in its own tspan", () => {
    vi.spyOn(tunerApi, "bandLabelOf").mockReturnValue("Deep House");
    const { container } = render(<BigName />);
    act(() => usePlayer.setState({ current: station() }));
    const path = container.querySelector("textPath")!;
    expect(text(path)).toBe("DEEP HOUSE FM · 98.3 · DEEP HOUSE · NL · ");
    expect(path.querySelector("tspan")).toHaveTextContent("98.3");
    expect(path).toHaveAttribute("lengthAdjust", "spacing");
    expect(Number(path.getAttribute("textLength"))).toBeCloseTo(2 * Math.PI * 96 - 6, 0);
    const href = path.getAttribute("href")!;
    expect(container.querySelector(`path[id="${href.slice(1)}"]`)).not.toBeNull();
  });

  it("fades both out while tuning and back after", () => {
    const { container } = render(<BigName />);
    act(() => usePlayer.setState({ current: station(), tuning: true }));
    const { ticker, orbit } = layers(container);
    expect(ticker.className).toMatch(/out/);
    expect(orbit.className).toMatch(/out/);
    expect(orbit.querySelector("g")!.getAttribute("class")).toMatch(/hide/);
    act(() => usePlayer.setState({ tuning: false }));
    expect(ticker.className).not.toMatch(/out/);
    expect(orbit.className).not.toMatch(/out/);
  });

  it("renders nothing readable without a station", () => {
    const { container } = render(<BigName />);
    expect(text(container)).toBe("");
  });
});
