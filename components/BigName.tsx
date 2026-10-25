"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useStationMeta } from "@/hooks/useStationMeta";
import { usePlayer } from "@/store/player";
import { useViz } from "@/store/visualizer";
import styles from "./BigName.module.css";

const TICKER_REPEATS = 8;
const TICKER_PX_PER_S = 70;
/** Ring radius in the orbit's viewBox units (-110..110). */
const ORBIT_R = 96;

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/** The name whose letters have risen; lags `name` by two frames so each new name animates from its start state. */
function useRisen(name: string) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!name) {
      // Back to empty: forget the last name so returning to it rises again.
      const t = requestAnimationFrame(() => setShown(""));
      return () => cancelAnimationFrame(t);
    }
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setShown(name));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [name]);
  return shown;
}

type Props = { name: string; tuning: boolean };

/** The song on the orbit is cut to this many characters so the ring's spacing stays readable. */
const ORBIT_SONG_MAX = 32;

/** A band behind the blob repeating `NAME ● FREQ ● SONG ●`, scrolling left at a steady ~70 px/s. */
function Ticker({ name, tuning, freq, song }: Props & { freq: string | null; song: string | null }) {
  const shown = useRisen(name);
  const bandRef = useRef<HTMLDivElement>(null);
  const upper = name.toUpperCase();

  useLayoutEffect(() => {
    const band = bandRef.current;
    if (!band) return;
    // One loop moves the band by half its width (half the repeats): keep the speed, not the duration, constant.
    const time = () => {
      const px = band.scrollWidth / 2;
      if (px > 0) band.style.animationDuration = `${(px / TICKER_PX_PER_S).toFixed(1)}s`;
    };
    time();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(time) : null;
    ro?.observe(band);
    return () => ro?.disconnect();
  }, [upper, freq, song]);

  return (
    <div aria-hidden="true" data-variant="ticker" className={cx(styles.alt, styles.ticker, styles.wide, tuning && styles.out)}>
      {name && (
        // Keyed by the content so the scroll restarts from the left for each station.
        <div key={`${upper}|${freq}|${song}`} ref={bandRef} className={cx(styles.band, shown === name && styles.in)}>
          {Array.from({ length: TICKER_REPEATS }, (_, i) => (
            <span key={i} data-ticker-item className={styles.item}>
              {upper}
              <i>●</i>
              {freq && (
                <>
                  {freq}
                  <i>●</i>
                </>
              )}
              {song && (
                <>
                  {song.toUpperCase()}
                  <i>●</i>
                </>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** `NAME · FREQ · SONG ·` (or `· GENRE · CC ·` until a song is known) on a slowly turning ring, stretched to fill it. */
function Orbit({
  name,
  tuning,
  freq,
  genre,
  cc,
  song,
}: Props & { freq: string | null; genre?: string; cc?: string; song: string | null }) {
  const shown = useRisen(name);
  const ringId = `ring-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const sep = " · ";
  const visible = !!name && shown === name && !tuning;
  const tail = song
    ? song.length > ORBIT_SONG_MAX
      ? `${song.slice(0, ORBIT_SONG_MAX - 1).trimEnd()}…`
      : song
    : [genre, cc].filter(Boolean).join(sep);

  return (
    <div aria-hidden="true" data-variant="orbit" className={cx(styles.alt, styles.orbit, styles.narrow, tuning && styles.out)}>
      {name && (
        <svg viewBox="-110 -110 220 220">
          <defs>
            <path id={ringId} d={`M 0,-${ORBIT_R} a ${ORBIT_R},${ORBIT_R} 0 1,1 -0.01,0`} />
          </defs>
          <g className={cx(styles.fade, !visible && styles.hide)}>
            <text>
              <textPath
                href={`#${ringId}`}
                textLength={(2 * Math.PI * ORBIT_R - 6).toFixed(1)}
                lengthAdjust="spacing"
              >
                {name.toUpperCase()}
                {sep}
                {freq && (
                  <>
                    <tspan className={styles.f}>{freq}</tspan>
                    {sep}
                  </>
                )}
                {tail && `${tail.toUpperCase()}${sep}`}
              </textPath>
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}

/**
 * The station name around the blob: a scrolling ticker band on wide screens, a turning ring on phones. Both are
 * rendered and CSS (the 760 px breakpoint) shows one, so there is no viewport check in JS and no hydration flicker;
 * the hidden one is `display: none`, so its animation doesn't run. Decorative: the readout carries the text.
 */
export function BigName() {
  const tuning = usePlayer((s) => s.tuning);
  const song = usePlayer((s) => s.nowPlaying);
  const lines = useViz((s) => s.mode === "ridges");
  const meta = useStationMeta();
  const info = { name: meta?.name ?? "", tuning, freq: meta?.freq ?? null, song };
  // The signal ridges fill the stage edge to edge: the big name would only fight them (the readout keeps it).
  if (lines) return null;
  return (
    <>
      <Ticker {...info} />
      <Orbit {...info} genre={meta?.genre} cc={meta?.cc} />
    </>
  );
}
