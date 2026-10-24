"use client";

import { useState } from "react";
import { togglePlay } from "@/hooks/useEngineBridge";
import { flagEmoji } from "@/lib/flag";
import { usePlayer } from "@/store/player";
import { LiveClock } from "./LiveClock";
import { StationList } from "./StationList";
import { StationMarquee } from "./StationMarquee";

const divider = <div className="h-full bg-muted w-px" />;
const iconBtn =
  "size-11 flex items-center justify-center text-gray-200 enabled:hover:text-accent disabled:text-gray-500 transition-colors";

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
      {children}
    </svg>
  );
}

export function PlayBar() {
  const current = usePlayer((s) => s.current);
  const status = usePlayer((s) => s.status);
  const muted = usePlayer((s) => s.muted);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const [listOpen, setListOpen] = useState(false);

  const playing = status === "playing";
  const flag = current ? flagEmoji(current.countryCode) : "";

  return (
    <div className="absolute bottom-0 z-20 h-16 w-full text-foreground text-xl text-center flex items-center border-t border-muted">
      <div className="h-full hidden md:flex items-center justify-center px-7 text-2xl">
        {flag ? <span title={current?.country}>{flag}</span> : <div className="w-6 h-4 bg-gray-700" />}
      </div>
      <div className="hidden md:block h-full">{divider}</div>
      <div className="min-w-0 flex-1 md:flex-none md:w-72 flex items-center justify-center text-2xl font-light text-gray-200 px-2">
        {current ? <StationMarquee station={current} /> : <span className="text-gray-500">No station selected</span>}
      </div>
      {divider}
      <div className="h-full flex items-center justify-center px-2 md:px-7">
        <button
          type="button"
          onClick={toggleMute}
          disabled={!current}
          aria-label={muted ? "Unmute" : "Mute"}
          className={iconBtn}
        >
          <Svg>
            {muted ? (
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.6 3 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4-2.4-2.4z" />
            ) : (
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
            )}
          </Svg>
        </button>
      </div>
      {divider}
      <div className="h-full flex items-center md:flex-1 gap-2 md:gap-4 px-2 md:px-7">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!current || status === "loading"}
          aria-label={playing ? "Pause" : "Play"}
          className={iconBtn}
        >
          <Svg>{playing ? <path d="M6 5h4v14H6zm8 0h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</Svg>
        </button>
        {status === "blocked" && <span className="text-base text-accent whitespace-nowrap">Tap to play</span>}
        <div className="ml-auto whitespace-nowrap text-muted text-base hidden sm:block">
          {current ? (
            <LiveClock key={current.id} playing={playing} />
          ) : (
            <span className="text-gray-500">--:--:-- / --:--:--</span>
          )}
        </div>
      </div>
      {divider}
      <div className="h-full px-2 md:px-7 flex items-center justify-center">
        {/* Heart slot: enabled in Task 9. */}
        <button type="button" disabled aria-label="Save station" className={iconBtn}>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" />
          </svg>
        </button>
      </div>
      {divider}
      <div className="h-full px-2 md:px-7 flex items-center justify-center">
        <button type="button" onClick={() => setListOpen(true)} aria-label="Stations" className={iconBtn}>
          <Svg>
            <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
          </Svg>
        </button>
      </div>
      {listOpen && <StationList onClose={() => setListOpen(false)} />}
    </div>
  );
}
