import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ALL_FAILED_MESSAGE, DIRECTORY_ERROR_MESSAGE, useReadoutState } from "@/hooks/useReadoutState";
import { useDial } from "@/store/dial";
import { usePlayer } from "@/store/player";

beforeEach(() => {
  useDial.setState({ needleGenre: null, bands: useDial.getState().bands.map((b) => ({ ...b, state: "idle", stations: [] })) });
  usePlayer.setState({ status: "idle", current: null });
});

describe("useReadoutState", () => {
  it("is empty normally", () => {
    expect(renderHook(() => useReadoutState()).result.current).toEqual({});
  });

  it("reports a directory error with Retry for the needle's band", () => {
    const genre = useDial.getState().bands[2].genre;
    useDial.setState({ needleGenre: genre });
    act(() => useDial.getState().patchBand(genre, { state: "error" }));
    const { result } = renderHook(() => useReadoutState());
    expect(result.current.message).toBe(DIRECTORY_ERROR_MESSAGE);
    act(() => result.current.onRetry!());
    expect(useDial.getState().bands[2].state).toBe("idle");
  });

  it("falls back to the first band when the needle has no band", () => {
    act(() => useDial.getState().patchBand(useDial.getState().bands[0].genre, { state: "error" }));
    expect(renderHook(() => useReadoutState()).result.current.message).toBe(DIRECTORY_ERROR_MESSAGE);
  });

  it("ignores errors on other bands", () => {
    useDial.setState({ needleGenre: useDial.getState().bands[1].genre });
    act(() => useDial.getState().patchBand(useDial.getState().bands[3].genre, { state: "error" }));
    expect(renderHook(() => useReadoutState()).result.current).toEqual({});
  });

  it("all-failed wins over a directory error, has no Retry, and clears on select", () => {
    act(() => useDial.getState().patchBand(useDial.getState().bands[0].genre, { state: "error" }));
    usePlayer.setState({ status: "error" });
    const { result } = renderHook(() => useReadoutState());
    expect(result.current).toEqual({ message: ALL_FAILED_MESSAGE });
    act(() =>
      usePlayer.getState().select({ id: "x", name: "X", streamUrl: "u", tags: [], countryCode: "DE" } as never),
    );
    expect(result.current.message).toBe(DIRECTORY_ERROR_MESSAGE);
  });
});
