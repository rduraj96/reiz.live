"use client";

import { togglePlay } from "@/hooks/useEngineBridge";
import { usePlayer } from "@/store/player";
import { HeartButton } from "./HeartButton";
import { ShareButton } from "./ShareButton";
import { StationMarquee } from "./StationMarquee";

const iconBtn =
  "size-11 shrink-0 flex items-center justify-center text-gray-200 enabled:hover:text-accent disabled:text-gray-500 transition-colors";

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Phone play bar (below md): name, play/pause, heart, Stations. */
export function CompactPlayBar() {
  const current = usePlayer((s) => s.current);
  const status = usePlayer((s) => s.status);
  const openPanel = usePlayer((s) => s.openPanel);

  const playing = status === "playing";
  const blocked = status === "blocked";

  return (
    <div className="md:hidden absolute bottom-0 z-20 h-16 w-full text-foreground flex items-center gap-1 px-2 border-t border-muted">
      <div className="min-w-0 flex-1 text-xl font-light text-gray-200 px-1">
        {current ? <StationMarquee station={current} /> : <span className="text-gray-500">No station selected</span>}
      </div>
      <button
        type="button"
        onClick={togglePlay}
        disabled={!current || status === "loading"}
        aria-label={blocked ? "Tap to play" : playing ? "Pause" : "Play"}
        className={`${iconBtn} ${blocked ? "!text-accent animate-pulse" : ""}`}
      >
        <Svg>{playing ? <path d="M6 5h4v14H6zm8 0h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</Svg>
      </button>
      <HeartButton station={current} className={iconBtn} />
      <ShareButton station={current} className={iconBtn} />
      <button type="button" onClick={() => openPanel("browse")} aria-label="Stations" className={iconBtn}>
        <Svg>
          <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
        </Svg>
      </button>
    </div>
  );
}
