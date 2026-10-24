import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("@/lib/radio/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/radio/client")>()),
  byId: vi.fn(),
}));

import { RadioBrowserError, byId } from "@/lib/radio/client";
import { shareLinkStation } from "@/lib/radio/cachedStation";

afterEach(() => vi.restoreAllMocks());

describe("shareLinkStation", () => {
  it("maps RadioBrowserError to null and logs it", async () => {
    const err = new RadioBrowserError("down");
    vi.mocked(byId).mockRejectedValue(err);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await shareLinkStation("x")).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("x"), err);
  });

  it("maps any other error to null and logs it", async () => {
    // In production, errors crossing the "use cache" boundary lose name and message.
    const err = new Error();
    vi.mocked(byId).mockRejectedValue(err);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await shareLinkStation("x")).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("x"), err);
  });

  it("returns null for an unknown station without logging", async () => {
    vi.mocked(byId).mockResolvedValue(null);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await shareLinkStation("x")).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });
});
