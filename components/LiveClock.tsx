"use client";

import { useEffect, useState } from "react";

function format(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Listening time for the mounted station (key it by station id) / Live. Counts only while playing. */
export function LiveClock({ playing }: { playing: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [playing]);

  return (
    <>
      {format(elapsed)} / <span className="text-accent font-semibold">Live</span>
    </>
  );
}
