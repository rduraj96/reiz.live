import "@testing-library/jest-dom/vitest";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BigName, splitName } from "@/components/BigName";
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

describe("splitName", () => {
  it("cuts at the word boundary nearest the middle", () => {
    expect(splitName("Deep House FM")).toEqual(["DEEP", "HOUSE FM"]);
    expect(splitName("Radio Paradise")).toEqual(["RADIO", "PARADISE"]);
    expect(splitName("BBC Radio 6 Music")).toEqual(["BBC RADIO", "6 MUSIC"]);
  });

  it("takes the nearest space on either side, never breaking a word when there is a space", () => {
    expect(splitName("Le Grand Mix")).toEqual(["LE GRAND", "MIX"]);
    expect(splitName("A Longername")).toEqual(["A", "LONGERNAME"]);
  });

  it("halves a single word", () => {
    expect(splitName("Jazz")).toEqual(["JA", "ZZ"]);
  });
});

describe("BigName variants", () => {
  it("defaults to the original outlined name", () => {
    const { container } = render(<BigName />);
    act(() => usePlayer.setState({ current: station() }));
    expect(container.firstElementChild).toHaveAttribute("data-variant", "original");
  });

  it("ticker: repeats NAME ● FREQ ● along an aria-hidden band", () => {
    const { container } = render(<BigName variant="ticker" />);
    act(() => usePlayer.setState({ current: station() }));
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("data-variant", "ticker");
    const items = root.querySelectorAll("[data-ticker-item]");
    expect(items.length).toBeGreaterThanOrEqual(6);
    items.forEach((item) => expect(text(item)).toBe("DEEP HOUSE FM●98.3●"));
  });

  it("ticker: drops the frequency off the dial", () => {
    const { container } = render(<BigName variant="ticker" />);
    act(() => usePlayer.setState({ current: station({ id: "x" }) }));
    expect(text(container.querySelector("[data-ticker-item]"))).toBe("DEEP HOUSE FM●");
  });

  it("part: two halves split at a word boundary", () => {
    const { container } = render(<BigName variant="part" />);
    act(() => usePlayer.setState({ current: station() }));
    const halves = container.querySelectorAll("[data-half]");
    expect(halves).toHaveLength(2);
    expect(text(halves[0])).toBe("DEEP");
    expect(text(halves[1])).toBe("HOUSE FM");
  });

  it("orbit: name · freq · genre · cc on a ring, frequency in its own tspan", () => {
    vi.spyOn(tunerApi, "bandLabelOf").mockReturnValue("Deep House");
    const { container } = render(<BigName variant="orbit" />);
    act(() => usePlayer.setState({ current: station() }));
    const path = container.querySelector("textPath")!;
    expect(text(path)).toBe("DEEP HOUSE FM · 98.3 · DEEP HOUSE · NL · ");
    expect(path.querySelector("tspan")).toHaveTextContent("98.3");
    expect(path).toHaveAttribute("lengthAdjust", "spacing");
    expect(Number(path.getAttribute("textLength"))).toBeCloseTo(2 * Math.PI * 96 - 6, 0);
    const href = path.getAttribute("href")!;
    expect(container.querySelector(`path[id="${href.slice(1)}"]`)).not.toBeNull();
  });

  it("stack: the name, then a meta line with the frequency in bold", () => {
    const { container } = render(<BigName variant="stack" />);
    act(() => usePlayer.setState({ current: station() }));
    expect(text(container.querySelector("[data-stack-name]"))).toBe("DEEP HOUSE FM");
    const meta = container.querySelector("[data-stack-meta]")!;
    expect(text(meta)).toBe("98.3 · HOUSE · NL");
    expect(meta.querySelector("b")).toHaveTextContent("98.3");
  });

  it.each(["ticker", "part", "orbit", "stack"] as const)("%s: fades out while tuning", (variant) => {
    const { container } = render(<BigName variant={variant} />);
    act(() => usePlayer.setState({ current: station(), tuning: true }));
    expect(container.firstElementChild!.className).toMatch(/out/);
    act(() => usePlayer.setState({ tuning: false }));
    expect(container.firstElementChild!.className).not.toMatch(/out/);
  });

  it.each(["ticker", "part", "orbit", "stack"] as const)("%s: renders nothing readable without a station", (variant) => {
    const { container } = render(<BigName variant={variant} />);
    expect(text(container)).toBe("");
  });
});
