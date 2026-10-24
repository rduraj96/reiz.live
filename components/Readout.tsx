"use client";

import { useEffect, useRef } from "react";
import { useDial } from "@/store/dial";
import { usePlayer } from "@/store/player";
import { HeartButton } from "./HeartButton";
import { ShareButton } from "./ShareButton";
import { tunerApi } from "./Tuner";

const ROLL_STEPS = 8;
const ROLL_MS = 38;
const SEP = " · ";

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

const randomFreq = () => (87.5 + Math.random() * 20).toFixed(1);

const iconBtn =
  "grid size-11 shrink-0 place-items-center rounded-full text-muted transition-[color,background-color,transform] duration-200 " +
  "hover:bg-white/10 hover:text-foreground active:scale-90 aria-pressed:text-accent disabled:opacity-40";

/**
 * Frequency that rolls through 8 random values, then lands on the station's real one.
 * Written straight to the DOM (number and its separator), so the 38 ms ticks cost no renders.
 */
function useRolledFrequency(id: string | null) {
  const numRef = useRef<HTMLElement>(null);
  const sepRef = useRef<HTMLSpanElement>(null);
  const rolledId = useRef<string | null>(null);
  // The dial layout derives from the bands; re-read when it changes (the Tuner may not have built it yet).
  const bands = useDial((s) => s.bands);

  useEffect(() => {
    const show = (text: string | null) => {
      if (numRef.current) numRef.current.textContent = text ?? "";
      if (sepRef.current) sepRef.current.textContent = text === null ? "" : SEP;
    };
    const target = id ? tunerApi.frequencyOf(id) : null;
    const sameStation = rolledId.current === id;
    rolledId.current = id;
    // Same station, layout moved: land on the (new) number without another roll.
    if (target === null || sameStation || reducedMotion()) {
      show(target);
      return;
    }
    let n = 0;
    show(randomFreq());
    const timer = setInterval(() => {
      show(n++ >= ROLL_STEPS ? target : randomFreq());
      if (n > ROLL_STEPS) clearInterval(timer);
    }, ROLL_MS);
    return () => clearInterval(timer);
  }, [id, bands]);

  return { numRef, sepRef };
}

export function Readout({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const current = usePlayer((s) => s.current);
  const tuning = usePlayer((s) => s.tuning);
  const { numRef, sepRef } = useRolledFrequency(current?.id ?? null);

  const rest = current ? [current.tags[0]?.toUpperCase(), current.countryCode.toUpperCase()].filter(Boolean) : [];

  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-3 px-5 pb-2.5 md:px-8 md:pb-3.5">
      <div className="min-w-0">
        <div
          data-freq
          className="text-xs uppercase tracking-[0.14em] text-muted [font-variant-numeric:tabular-nums]"
        >
          <b ref={numRef} className="font-normal text-accent" />
          {rest.length > 0 && <span ref={sepRef} />}
          {rest.join(SEP)}
        </div>
        {message ? (
          <div className="mt-1 flex items-center gap-3 text-xl md:text-[26px]">
            <span className="truncate">{message}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="min-h-11 shrink-0 text-xs uppercase tracking-[0.14em] text-accent hover:text-foreground"
              >
                Retry
              </button>
            )}
          </div>
        ) : (
          <div
            className={`mt-1 truncate whitespace-nowrap text-xl tracking-[-0.01em] transition-opacity duration-200 md:text-[26px] ${tuning ? "opacity-35" : ""}`}
          >
            {current?.name}
          </div>
        )}
      </div>
      <div className="flex gap-0.5">
        <HeartButton station={current} className={iconBtn} />
        <ShareButton station={current} className={iconBtn} />
        <button type="button" aria-label="Surprise me" onClick={() => tunerApi.shuffle()} className={iconBtn}>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M3 7h3.5c2 0 3.2 1 4.5 3l2 4c1.3 2 2.5 3 4.5 3H21M3 17h3.5c2 0 3.2-1 4.5-3M13 8c1.3-1.5 2.5-2 4.5-2H21M18 3l3 3-3 3M18 14l3 3-3 3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
