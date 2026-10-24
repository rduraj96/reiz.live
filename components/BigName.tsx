"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useStationMeta } from "@/hooks/useStationMeta";
import { usePlayer } from "@/store/player";
import styles from "./BigName.module.css";

export type NameVariant = "original" | "ticker" | "part" | "orbit" | "stack";

const STAGGER_MS = 32;
const LONG_NAME = 14;
const TICKER_REPEATS = 8;
const TICKER_PX_PER_S = 70;
/** Ring radius in the orbit's viewBox units (-110..110). */
const ORBIT_R = 96;
/** Blob width, as in Player's BlobButton (`min(70vw, 360px)`). */
const blobWidth = () => Math.min(window.innerWidth * 0.7, 360);
/** Room for one half of the parted name beside the opened gap (1.12 × blob). */
const sideRoom = (stage: number) => (stage - blobWidth() * 1.12) / 2 - 16;
/** Below this many px beside the blob, the name parts vertically instead. */
const PART_MIN_SIDE = 100;

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/** Split an uppercased name at the space nearest its middle; a single word is halved. */
export function splitName(name: string): [string, string] {
  const n = name.toUpperCase().trim();
  const mid = n.length / 2;
  let cut = -1;
  for (let i = 0; i < n.length; i++) {
    if (n[i] === " " && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
  }
  if (cut < 0) cut = Math.ceil(mid);
  return [n.slice(0, cut).trim(), n.slice(cut).trim()];
}

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

/** One inline-block span per character, staggered; `in` once risen. */
function Letters({ text, risen, offset = 0 }: { text: string; risen: boolean; offset?: number }) {
  const reduced = reducedMotion();
  return (
    <>
      {[...text].map((ch, i) => (
        <span
          key={`${text}-${i}`}
          className={cx(styles.letter, risen && styles.in)}
          style={{ transitionDelay: `${reduced ? 0 : (offset + i) * STAGGER_MS}ms` }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </>
  );
}

/** Shrink `els` from `start` px until the widest fits `room()` px; re-runs on resize and once fonts load. */
function useFit(
  rootRef: RefObject<HTMLElement | null>,
  elsRef: RefObject<(HTMLElement | null)[]>,
  measure: (root: HTMLElement) => { start: number; room: number },
  key: string,
) {
  const measureRef = useRef(measure);
  useLayoutEffect(() => {
    measureRef.current = measure;
  });
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fit = () => {
      const els = elsRef.current.filter((e): e is HTMLElement => !!e);
      if (els.length === 0) return;
      const { start, room } = measureRef.current(root);
      els.forEach((el) => (el.style.fontSize = `${start}px`));
      const widest = Math.max(...els.map((el) => el.scrollWidth));
      if (widest > room && room > 0) {
        const size = Math.max(14, (start * room) / widest);
        els.forEach((el) => (el.style.fontSize = `${size}px`));
      }
    };
    fit();
    let alive = true;
    document.fonts?.ready.then(() => alive && fit());
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(root);
    return () => {
      alive = false;
      ro?.disconnect();
    };
  }, [rootRef, elsRef, key]);
}

type Props = { name: string; tuning: boolean };

/** The original: a huge outlined name behind the blob; letters rise in with a stagger, and blur away while tuning. */
function Original({ name, tuning }: Props) {
  const shown = useRisen(name);
  return (
    <div
      aria-hidden="true"
      data-variant="original"
      className={cx(styles.bigname, name.length > LONG_NAME && styles.long, tuning && styles.out)}
    >
      <Letters text={name} risen={shown === name} />
    </div>
  );
}

/** A band behind the blob repeating `NAME ● FREQ ●`, scrolling left at a steady ~70 px/s. */
function Ticker({ name, tuning, freq }: Props & { freq: string | null }) {
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
  }, [upper, freq]);

  return (
    <div aria-hidden="true" data-variant="ticker" className={cx(styles.alt, styles.ticker, tuning && styles.out)}>
      {name && (
        // Keyed by the content so the scroll restarts from the left for each station.
        <div key={`${upper}|${freq}`} ref={bandRef} className={cx(styles.band, shown === name && styles.in)}>
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
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The name split in two halves that part around the blob; the type is fitted so the wider half fits beside it.
 * Where the sides are too narrow for that (phones), the halves part vertically: one above the blob, one below.
 */
function Part({ name, tuning }: Props) {
  const shown = useRisen(name);
  const rootRef = useRef<HTMLDivElement>(null);
  const halvesRef = useRef<(HTMLElement | null)[]>([]);
  const [vertical, setVertical] = useState(false);
  const [left, right] = name ? splitName(name) : ["", ""];
  const risen = !!name && shown === name;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setVertical(sideRoom(root.clientWidth) < PART_MIN_SIDE));
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  useFit(
    rootRef,
    halvesRef,
    (root) => {
      const stage = root.clientWidth;
      return vertical
        ? { start: Math.min(120, stage * 0.13), room: stage - 32 }
        : { start: Math.min(120, stage * 0.085), room: sideRoom(stage) };
    },
    `${name}|${vertical}`,
  );

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-variant="part"
      className={cx(
        styles.alt,
        styles.part,
        vertical && styles.vertical,
        risen && !tuning && styles.open,
        tuning && styles.out,
      )}
    >
      {name && (
        <div className={styles.row}>
          <span data-half ref={(el) => void (halvesRef.current[0] = el)} className={styles.half}>
            <Letters text={left} risen={risen} />
          </span>
          <span className={styles.gap} />
          <span data-half ref={(el) => void (halvesRef.current[1] = el)} className={styles.half}>
            <Letters text={right} risen={risen} offset={left.length} />
          </span>
        </div>
      )}
    </div>
  );
}

/** `NAME · FREQ · GENRE · CC ·` on a slowly turning ring around the blob, stretched to fill the circle. */
function Orbit({ name, tuning, freq, genre, cc }: Props & { freq: string | null; genre?: string; cc?: string }) {
  const shown = useRisen(name);
  const ringId = `ring-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const sep = " · ";
  const visible = !!name && shown === name && !tuning;
  const tail = [genre, cc].filter(Boolean).join(sep);

  return (
    <div aria-hidden="true" data-variant="orbit" className={cx(styles.alt, styles.orbit, tuning && styles.out)}>
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
                {tail && `${tail}${sep}`}
              </textPath>
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}

/** The solid name above the blob, letters rising in, with `FREQ · GENRE · CC` under it. */
function Stack({ name, tuning, freq, genre, cc }: Props & { freq: string | null; genre?: string; cc?: string }) {
  const shown = useRisen(name);
  const rootRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<(HTMLElement | null)[]>([]);
  const upper = name.toUpperCase();
  const rest = [genre, cc].filter(Boolean).join(" · ");

  useFit(
    rootRef,
    nameRef,
    (root) => {
      const stage = root.clientWidth;
      // Matches the CSS clamp: clamp(30px, 6vw, 72px), smaller for long names.
      const vw = window.innerWidth / 100;
      const start = name.length > LONG_NAME ? Math.min(52, Math.max(24, 4.5 * vw)) : Math.min(72, Math.max(30, 6 * vw));
      return { start, room: stage - 32 };
    },
    name,
  );

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-variant="stack"
      className={cx(styles.alt, styles.stack, tuning && styles.out)}
    >
      {name && (
        <div className={styles.stackBlock}>
          <div data-stack-name ref={(el) => void (nameRef.current[0] = el)} className={styles.stackName}>
            <Letters text={upper} risen={shown === name} />
          </div>
          <div data-stack-meta className={styles.meta}>
            {freq && (
              <>
                <b>{freq}</b>
                {rest && " · "}
              </>
            )}
            {rest}
          </div>
        </div>
      )}
    </div>
  );
}

/** Extra classes for the centre row (the stack variant moves the blob down to make room above it). */
export const centreRowClass = (variant: NameVariant) => (variant === "stack" ? styles.stackRow : "");

/** The station name behind/around the blob, in one of several treatments. Decorative: the readout carries the text. */
export function BigName({ variant = "original" }: { variant?: NameVariant }) {
  const tuning = usePlayer((s) => s.tuning);
  const meta = useStationMeta();
  const name = meta?.name ?? "";
  const info = { name, tuning, freq: meta?.freq ?? null, genre: meta?.genre, cc: meta?.cc };

  switch (variant) {
    case "ticker":
      return <Ticker {...info} />;
    case "part":
      return <Part {...info} />;
    case "orbit":
      return <Orbit {...info} />;
    case "stack":
      return <Stack {...info} />;
    default:
      return <Original name={name} tuning={tuning} />;
  }
}
