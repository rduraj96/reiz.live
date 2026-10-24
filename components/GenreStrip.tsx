"use client";

import { useEffect, useRef } from "react";
import { OFF_DIAL_GENRE } from "@/lib/dial/layout";
import { useDial } from "@/store/dial";
import { tunerApi } from "./Tuner";

/** Preset row above the dial, like a car radio's: every genre band, the one under the needle lit; tapping one glides there. */
export function GenreStrip() {
  const bands = useDial((s) => s.bands);
  const needleGenre = useDial((s) => s.needleGenre);
  const listRef = useRef<HTMLUListElement>(null);
  const presets = bands.filter((b) => b.genre !== OFF_DIAL_GENRE);
  // One tab stop for the whole row (the lit preset, else the first); arrow keys move between presets.
  const focusIndex = Math.max(0, presets.findIndex((b) => b.genre === needleGenre));

  const onKeyDown = (e: React.KeyboardEvent) => {
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: buttons.length - 1 }[e.key];
    if (next === undefined || i < 0) return;
    e.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
  };

  // Keep the lit preset in view as the needle moves across bands.
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    list.scrollTo({ left: el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2, behavior: reduced ? "auto" : "smooth" });
  }, [needleGenre]);

  return (
    <nav aria-label="Genres" className="relative">
      <ul
        ref={listRef}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto px-3 [mask-image:linear-gradient(90deg,transparent,#000_32px,#000_calc(100%-32px),transparent)] [scrollbar-width:none] md:px-6 min-[1440px]:px-14 [&::-webkit-scrollbar]:hidden"
      >
        {presets.map((b, i) => {
          const active = b.genre === needleGenre;
          return (
            <li key={b.genre} className="shrink-0">
              <button
                type="button"
                aria-current={active || undefined}
                tabIndex={i === focusIndex ? 0 : -1}
                onClick={() => tunerApi.tuneBand(b.genre)}
                className={`flex min-h-11 items-center gap-1.5 whitespace-nowrap px-2 text-[11px] uppercase tracking-[0.16em] transition-colors ${
                  active ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <span aria-hidden="true" className={`size-1.5 rounded-full bg-accent ${active ? "" : "invisible"}`} />
                {b.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
