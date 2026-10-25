"use client";

import { toggleSaved, useSaved } from "@/lib/library/saved";
import type { Station } from "@/lib/radio/types";

export function HeartButton({ station, className }: { station: Station | null; className?: string }) {
  const saved = useSaved().some((x) => x.id === station?.id);

  return (
    <button
      type="button"
      disabled={!station}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save station"}
      onClick={() => station && toggleSaved(station)}
      className={className}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" />
      </svg>
    </button>
  );
}
