"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  bandAt,
  buildLayout,
  DIAL_SLOTS,
  frequencyOf,
  nearestStation,
  OFF_DIAL_GENRE,
  positionOf,
  STATION_GAP,
  type DialBand,
  type DialLayout,
} from "@/lib/dial/layout";
import type { Station } from "@/lib/radio/types";
import { useDial } from "@/store/dial";
import { usePlayer } from "@/store/player";
import styles from "./Tuner.module.css";

type OffDial = { station: Station; label: string };
type GlideOpts = { fromOffset?: number; prime?: boolean };
type Handle = {
  glideTo: (id: string, opts?: GlideOpts) => void;
  shuffle: () => void;
  frequencyOf: (id: string) => string | null;
};

/** Glide easing per frame, and the distance under which a glide is done. */
const EASE = 0.16;
const DONE_PX = 0.5;
/** Release momentum: px/ms of drag velocity → px of extra travel. */
const MOMENTUM = 220;
const WHEEL_SNAP_MS = 140;
const LOCK_MS = 500;

let handle: Handle | null = null;

/** Imperative access for Shuffle and the intro; a no-op while no Tuner is mounted. */
export const tunerApi = {
  glideTo(stationId: string, opts?: GlideOpts) {
    handle?.glideTo(stationId, opts);
  },
  shuffle() {
    handle?.shuffle();
  },
  /** Dial frequency of a station, or null when it isn't on the dial (or no Tuner is mounted). */
  frequencyOf(stationId: string): string | null {
    return handle?.frequencyOf(stationId) ?? null;
  },
};

type Entry = { station: Station; bandLabel: string; genre: string };

const reducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

const isOnBand = (bands: DialBand[], id: string) =>
  bands.some(
    (b) => b.state === "ready" && b.stations.slice(0, DIAL_SLOTS).some((s) => s.id === id),
  );

/** The band under x, or the closest one when x sits in a gap or past the ends. */
function closestBand(layout: DialLayout, x: number): string | null {
  const hit = bandAt(layout, x);
  if (hit !== null) return hit;
  let best: string | null = null;
  let bestD = Infinity;
  for (const b of layout.bands) {
    const d = x < b.start ? b.start - x : x - b.end;
    if (d < bestD) {
      bestD = d;
      best = b.genre;
    }
  }
  return best;
}

/** Start of the first real (non off-dial) band: real bands shift as a block when the off-dial band comes or goes. */
const realStart = (layout: DialLayout) =>
  layout.bands.find((b) => b.genre !== OFF_DIAL_GENRE)?.start ?? 0;

export function Tuner({ offDial }: { offDial?: OffDial }) {
  const bands = useDial((s) => s.bands);
  const current = usePlayer((s) => s.current);
  const offStation = offDial?.station;
  const offLabel = offDial?.label;

  // The leading off-dial band: the current station when no loaded band holds it, else the offDial prop's station.
  const lead = useMemo<OffDial | undefined>(() => {
    if (current) {
      if (isOnBand(bands, current.id)) return undefined;
      return { station: current, label: offStation?.id === current.id ? (offLabel ?? "") : "" };
    }
    if (offStation && !isOnBand(bands, offStation.id)) return { station: offStation, label: offLabel ?? "" };
    return undefined;
  }, [bands, current, offStation, offLabel]);

  const layout = useMemo(() => buildLayout(bands, lead), [bands, lead]);

  const { byId, order } = useMemo(() => {
    const byId = new Map<string, Entry>();
    const all = lead ? [{ genre: OFF_DIAL_GENRE, label: lead.label, stations: [lead.station] }, ...bands] : bands;
    for (const b of all) {
      for (const s of b.stations.slice(0, DIAL_SLOTS)) byId.set(s.id, { station: s, bandLabel: b.label, genre: b.genre });
    }
    const order = layout.ticks.flatMap((t) => (t.stationId === null ? [] : [t.stationId]));
    return { byId, order };
  }, [bands, lead, layout]);

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const needleRef = useRef<HTMLDivElement>(null);

  // Everything the frame loop and event handlers touch lives in refs: no React state per frame.
  const r = useRef({
    layout,
    byId,
    order,
    offset: 0,
    mounted: false,
    prevCurrentId: null as string | null,
    tickEls: new Map<string, HTMLElement>(),
    bandEls: new Map<string, HTMLElement[]>(),
    nearId: null as string | null,
    activeBand: null as string | null,
    glide: null as null | { id: string; raf: number; tuning: boolean },
    wheelTimer: null as ReturnType<typeof setTimeout> | null,
    lockTimer: null as ReturnType<typeof setTimeout> | null,
    drag: null as null | { lastX: number; lastT: number; vel: number },
  });

  // The imperative engine; built once (useState initialiser, never recomputed), reads everything through `r`.
  const [engine] = useState(() => {
    const s = () => r.current;

    const clamp = (x: number) => {
      const L = s().layout;
      if (L.bands.length === 0) return 0;
      return Math.max(L.bands[0].start, Math.min(L.width, x));
    };

    const paint = () => {
      const st = s();
      const x = st.offset;
      if (trackRef.current) trackRef.current.style.transform = `translateX(${-x}px)`;

      const near = nearestStation(st.layout, x)?.stationId ?? null;
      if (near !== st.nearId) {
        if (st.nearId) st.tickEls.get(st.nearId)?.classList.remove("near");
        if (near) st.tickEls.get(near)?.classList.add("near");
        st.nearId = near;
        const root = rootRef.current;
        if (root) {
          const e = near ? st.byId.get(near) : undefined;
          if (e) {
            root.setAttribute("aria-valuenow", String(st.order.indexOf(near!)));
            root.setAttribute("aria-valuetext", e.bandLabel ? `${e.station.name}, ${e.bandLabel}` : e.station.name);
          } else {
            root.removeAttribute("aria-valuenow");
            root.setAttribute("aria-valuetext", "No stations");
          }
        }
      }

      const band = closestBand(st.layout, x);
      if (band !== st.activeBand) {
        if (st.activeBand) st.bandEls.get(st.activeBand)?.forEach((el) => el.classList.remove("active"));
        if (band) st.bandEls.get(band)?.forEach((el) => el.classList.add("active"));
        st.activeBand = band;
      }

      // Loading follows the needle; the off-dial band stands in for the first real band.
      let needleGenre = band;
      if (band === OFF_DIAL_GENRE) {
        const i = st.layout.bands.findIndex((b) => b.genre === OFF_DIAL_GENRE);
        needleGenre = st.layout.bands[i + 1]?.genre ?? null;
      }
      if (needleGenre !== null && useDial.getState().needleGenre !== needleGenre) {
        useDial.getState().setNeedleGenre(needleGenre);
      }
    };

    const lock = () => {
      const n = needleRef.current;
      if (!n) return;
      n.classList.remove("lock");
      void n.offsetWidth; // restart the animation
      n.classList.add("lock");
      if (s().lockTimer) clearTimeout(s().lockTimer!);
      s().lockTimer = setTimeout(() => n.classList.remove("lock"), LOCK_MS);
    };

    const stopGlide = () => {
      const g = s().glide;
      if (g) cancelAnimationFrame(g.raf);
      s().glide = null;
    };

    const stopWheel = () => {
      if (s().wheelTimer) clearTimeout(s().wheelTimer!);
      s().wheelTimer = null;
    };

    const startTuning = () => {
      if (!usePlayer.getState().tuning) usePlayer.getState().setTuning(true);
    };

    /** Glide to a station; the target's x is re-read each frame so layout changes mid-glide are followed. */
    const animate = (id: string, tuning: boolean, onDone: (arrived: boolean) => void) => {
      stopGlide();
      const g = { id, raf: 0, tuning };
      s().glide = g;
      const reduced = reducedMotion();
      const step = () => {
        if (s().glide !== g) return;
        const target = positionOf(s().layout, id);
        if (target === null) {
          s().glide = null;
          onDone(false);
          return;
        }
        const d = target - s().offset;
        if (reduced || Math.abs(d) < DONE_PX) {
          s().offset = target;
          paint();
          s().glide = null;
          onDone(true);
          return;
        }
        s().offset += d * EASE;
        paint();
        g.raf = requestAnimationFrame(step);
      };
      step();
    };

    /** The queue that follows the dial: band stations in dial order, plus the off-dial station only when it's the one tuned. */
    const queueFor = (id: string) =>
      s().order.flatMap((sid) => {
        const e = s().byId.get(sid)!;
        return e.genre !== OFF_DIAL_GENRE || sid === id ? [e.station] : [];
      });

    /** A user (or intro/shuffle) tune: static on, glide, then load the settled station only. */
    const tuneTo = (id: string, prime = false) => {
      stopWheel();
      startTuning();
      animate(id, true, (arrived) => {
        const p = usePlayer.getState();
        const e = s().byId.get(id);
        if (arrived && e) {
          if (prime) {
            p.prime(e.station);
          } else {
            p.setList(queueFor(id));
            p.select(e.station);
          }
          lock();
        }
        usePlayer.getState().setTuning(false);
      });
    };

    const snap = (x: number) => {
      const n = nearestStation(s().layout, clamp(x));
      if (n) tuneTo(n.stationId);
      else usePlayer.getState().setTuning(false);
    };

    /** The station keys step from: the glide target while tuning, else the one under the needle. */
    const baseId = () => {
      const g = s().glide;
      if (g?.tuning) return g.id;
      return s().nearId ?? nearestStation(s().layout, s().offset)?.stationId ?? null;
    };

    const bandStep = (from: string, dir: 1 | -1): string | null => {
      const L = s().layout;
      const tick = L.ticks.find((t) => t.stationId === from);
      const bi = L.bands.findIndex((b) => b.genre === tick?.band);
      for (let i = bi + dir; i >= 0 && i < L.bands.length; i += dir) {
        const first = L.ticks.find((t) => t.band === L.bands[i].genre && t.stationId !== null);
        if (first) return first.stationId;
      }
      return null;
    };

    const onKey = (key: string): boolean => {
      const { order } = s();
      const handled = ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown", "Home", "End", "PageUp", "PageDown"];
      if (!handled.includes(key)) return false;
      if (s().drag) return true; // the pointer owns the dial while dragging
      const base = baseId();
      if (order.length === 0 || base === null) return true;
      const i = Math.max(0, order.indexOf(base));
      let target: string | null = null;
      if (key === "ArrowRight" || key === "ArrowUp") target = order[Math.min(order.length - 1, i + 1)];
      else if (key === "ArrowLeft" || key === "ArrowDown") target = order[Math.max(0, i - 1)];
      else if (key === "Home") target = order[0];
      else if (key === "End") target = order[order.length - 1];
      else target = bandStep(base, key === "PageDown" ? 1 : -1);
      if (target === null) return true;
      // Already resting on it: nothing to tune.
      if (target === base && !s().glide && positionOf(s().layout, target) === s().offset) return true;
      tuneTo(target);
      return true;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopGlide();
      startTuning();
      // Firefox reports line deltas (deltaMode 1); scale them to roughly pixels.
      const unit = e.deltaMode === 1 ? 16 : 1;
      const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
      s().offset = clamp(s().offset + delta);
      paint();
      stopWheel();
      s().wheelTimer = setTimeout(() => {
        s().wheelTimer = null;
        snap(s().offset);
      }, WHEEL_SNAP_MS);
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return; // primary button only; touch and pen report 0
      stopGlide();
      stopWheel();
      s().drag = { lastX: e.clientX, lastT: performance.now(), vel: 0 };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic or already-released pointers can't be captured; dragging still works.
      }
      startTuning();
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      const d = s().drag;
      if (!d) return;
      const now = performance.now();
      const dx = e.clientX - d.lastX;
      s().offset = clamp(s().offset - dx);
      d.vel = -dx / Math.max(now - d.lastT, 1);
      d.lastX = e.clientX;
      d.lastT = now;
      paint();
    };

    const onPointerUp = () => {
      const d = s().drag;
      if (!d) return;
      s().drag = null;
      snap(s().offset + d.vel * MOMENTUM);
    };

    const glideTo = (id: string, opts?: GlideOpts) => {
      if (!s().byId.has(id)) return;
      if (opts?.fromOffset !== undefined) {
        stopGlide();
        s().offset = opts.fromOffset;
        paint();
      }
      tuneTo(id, opts?.prime ?? false);
    };

    const shuffle = () => {
      const { order } = s();
      if (order.length === 0) return;
      const playing = usePlayer.getState().current?.id;
      const pool = order.length > 1 ? order.filter((id) => id !== playing) : order;
      tuneTo(pool[Math.floor(Math.random() * pool.length)]);
    };

    /** The current station changed outside the dial (panel pick, markFailed, share prime): glide there, no select. */
    const follow = (id: string) => {
      const st = s();
      if (st.drag || st.wheelTimer || st.glide?.tuning) return;
      if (positionOf(st.layout, id) === st.offset) return;
      animate(id, false, (arrived) => arrived && lock());
    };

    const dispose = () => {
      // Unmounting mid-tune drops the settle that would end tuning: end it here so the static stops.
      const st = s();
      const wasTuning = !!(st.glide?.tuning || st.wheelTimer || st.drag);
      stopGlide();
      stopWheel();
      if (s().lockTimer) clearTimeout(s().lockTimer!);
      s().drag = null;
      if (wasTuning) usePlayer.getState().setTuning(false);
    };

    return {
      paint,
      clamp,
      onKey,
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      glideTo,
      shuffle,
      follow,
      dispose,
    };
  });

  // Sync refs with the new layout, keep the needle on the same spot, then follow external `current` changes.
  useLayoutEffect(() => {
    const st = r.current;
    const prev = st.layout;
    st.layout = layout;
    st.byId = byId;
    st.order = order;

    const track = trackRef.current;
    st.tickEls = new Map();
    st.bandEls = new Map();
    if (track) {
      track.querySelectorAll<HTMLElement>("[data-station-id]").forEach((el) => {
        el.classList.remove("near");
        st.tickEls.set(el.dataset.stationId!, el);
      });
      track.querySelectorAll<HTMLElement>("[data-band]").forEach((el) => {
        el.classList.remove("active");
        const list = st.bandEls.get(el.dataset.band!) ?? [];
        list.push(el);
        st.bandEls.set(el.dataset.band!, list);
      });
    }
    const prevNear = st.nearId;
    st.nearId = null;
    st.activeBand = null;

    const currentId = current?.id ?? null;
    const currentPos = currentId ? positionOf(layout, currentId) : null;
    if (!st.mounted) {
      st.mounted = true;
      st.offset = currentPos ?? layout.bands[0]?.start ?? 0;
    } else if (prev !== layout) {
      // Keep the needle on the station it was over (if it really was over one). Exception: when that station just fell into the
      // off-dial band (its band reset, e.g. a language switch), stay in the same band so it reloads.
      const bandOf = (L: DialLayout, id: string) => L.ticks.find((t) => t.stationId === id)?.band;
      const oldX = prevNear ? positionOf(prev, prevNear) : null;
      const newX = prevNear ? positionOf(layout, prevNear) : null;
      const intoOffDial =
        prevNear !== null &&
        bandOf(layout, prevNear) === OFF_DIAL_GENRE &&
        bandOf(prev, prevNear) !== OFF_DIAL_GENRE;
      const wasOver = oldX !== null && Math.abs(st.offset - oldX) <= STATION_GAP / 2;
      if (wasOver && newX !== null && !intoOffDial) st.offset += newX - oldX;
      else st.offset += realStart(layout) - realStart(prev);
    }
    engine.paint();

    if (currentId !== st.prevCurrentId) {
      st.prevCurrentId = currentId;
      if (currentPos !== null) engine.follow(currentId!);
    }
  }, [layout, byId, order, current, engine]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.addEventListener("wheel", engine.onWheel, { passive: false });
    handle = {
      glideTo: engine.glideTo,
      shuffle: engine.shuffle,
      frequencyOf: (id) => frequencyOf(r.current.layout, id),
    };
    const mine = handle;
    return () => {
      root.removeEventListener("wheel", engine.onWheel);
      if (handle === mine) handle = null;
      engine.dispose();
    };
  }, [engine]);

  // Ticks, labels and rules render once per layout; per-frame state is written to the DOM directly.
  const marks = useMemo(() => {
    const out: React.ReactNode[] = [];
    const first = layout.bands[0]?.start ?? 0;
    out.push(
      <div
        key="scale"
        aria-hidden
        className={styles.scale}
        style={{ left: first - 2400, width: layout.width - first + 4800 }}
      />,
    );
    for (const b of layout.bands) {
      if (b.label) {
        out.push(
          <div key={`l-${b.genre}`} data-band={b.genre} className={styles.label} style={{ left: b.start }}>
            {b.label}
          </div>,
        );
      }
      out.push(
        <div
          key={`r-${b.genre}`}
          data-band={b.genre}
          className={styles.rule}
          style={{ left: b.start, width: Math.max(b.end - b.start, 12) }}
        />,
      );
      if (b.state === "empty" || b.state === "error") {
        out.push(
          <div key={`n-${b.genre}`} className={styles.note} style={{ left: b.start }}>
            {b.state === "empty" ? "No stations" : "Couldn't load"}
          </div>,
        );
      }
    }
    const stateOf = new Map(layout.bands.map((b) => [b.genre, b.state]));
    layout.ticks.forEach((t, k) => {
      if (t.stationId !== null) {
        out.push(
          <div
            key={`s-${t.stationId}`}
            data-station-id={t.stationId}
            className={`${styles.tick} ${styles.station}`}
            style={{ left: t.x }}
          />,
        );
      } else {
        const state = stateOf.get(t.band);
        if (state === "idle" || state === "loading") {
          out.push(<div key={`p-${k}`} className={`${styles.tick} ${styles.placeholder}`} style={{ left: t.x }} />);
        }
      }
    });
    return out;
  }, [layout]);

  return (
    <div
      ref={rootRef}
      className={styles.tuner}
      // aria-valuenow / aria-valuetext follow the needle and are written by paint(), not per render.
      // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
      role="slider"
      tabIndex={0}
      aria-label="Tune stations"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, order.length - 1)}
      onKeyDown={(e) => {
        if (engine.onKey(e.key)) e.preventDefault();
      }}
      onPointerDown={engine.onPointerDown}
      onPointerMove={engine.onPointerMove}
      onPointerUp={engine.onPointerUp}
      onPointerCancel={engine.onPointerUp}
    >
      <div ref={trackRef} className={styles.track}>
        {marks}
      </div>
      <div className={`${styles.fade} ${styles.fadeLeft}`} aria-hidden />
      <div className={`${styles.fade} ${styles.fadeRight}`} aria-hidden />
      <div ref={needleRef} className={styles.needle} aria-hidden />
    </div>
  );
}
