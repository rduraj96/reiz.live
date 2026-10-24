"use client";

import { useDial } from "@/store/dial";
import { usePlayer } from "@/store/player";

export const ALL_FAILED_MESSAGE = "Couldn't play any station here — tune somewhere else";
export const DIRECTORY_ERROR_MESSAGE = "Couldn't load stations";

export type ReadoutState = { message?: string; onRetry?: () => void };

const retry = () => useDial.getState().retryAll();

/** What the readout shows instead of a station name: all-failed over directory error over normal. */
export function useReadoutState(): ReadoutState {
  const allFailed = usePlayer((s) => s.status === "error");
  const directoryError = useDial((s) => {
    const band = s.bands.find((b) => b.genre === s.needleGenre) ?? s.bands[0];
    return band?.state === "error";
  });

  if (allFailed) return { message: ALL_FAILED_MESSAGE };
  if (directoryError) return { message: DIRECTORY_ERROR_MESSAGE, onRetry: retry };
  return {};
}
