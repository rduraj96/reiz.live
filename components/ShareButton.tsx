"use client";

import type { Station } from "@/lib/radio/types";
import { shareStation } from "@/lib/share";
import { useToast } from "@/store/toast";

export function ShareButton({ station, className }: { station: Station | null; className?: string }) {
  const show = useToast((s) => s.show);

  async function onClick() {
    if (!station) return;
    const result = await shareStation(station);
    if (result === "copied") show("Link copied");
    else if (result === "failed") show("Couldn't share this station");
  }

  return (
    <button type="button" disabled={!station} onClick={onClick} aria-label="Share station" className={className}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
      </svg>
    </button>
  );
}
