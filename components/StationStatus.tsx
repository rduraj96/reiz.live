"use client";

type StationStatusProps = {
  loading: boolean;
  listError: string | null;
  empty: boolean;
  playbackFailed: boolean;
  language: string;
  onRetry: () => void;
  onAnyLanguage: () => void;
};

const button =
  "min-h-11 px-4 rounded-lg border border-muted text-foreground hover:border-foreground transition-colors";

/** Loading skeleton / directory error / empty list / all-stations-failed message. */
export function StationStatus({
  loading,
  listError,
  empty,
  playbackFailed,
  language,
  onRetry,
  onAnyLanguage,
}: StationStatusProps) {
  if (listError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 text-center">
        <p>{listError}</p>
        <button type="button" className={button} onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  if (playbackFailed) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 text-center">
        <p>Couldn&apos;t play any station in this list</p>
        <button type="button" className={button} onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <div role="status" aria-label="Loading stations" className="flex w-full max-w-sm flex-col gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} data-testid="skeleton-row" className="h-8 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p>No stations for this combo</p>
        {language !== "any" && (
          <button type="button" className={button} onClick={onAnyLanguage}>
            Any language
          </button>
        )}
      </div>
    );
  }
  return null;
}
