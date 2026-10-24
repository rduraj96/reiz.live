/*
 * TEMPORARY — remove once a name style is chosen.
 * A floating switch for comparing the BigName treatments live. Remove this file, its use in Player.tsx and
 * tests/unit/name-style-picker.test.tsx, and drop the unused BigName variants.
 */
"use client";

import { useEffect, useState } from "react";
import type { NameVariant } from "@/components/BigName";

const KEY = "reizdio:name-style";

const STYLES: { value: NameVariant; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "ticker", label: "Ticker" },
  { value: "part", label: "Part" },
  { value: "orbit", label: "Orbit" },
  { value: "stack", label: "Stack" },
];

const isVariant = (v: string | null): v is NameVariant => STYLES.some((s) => s.value === v);

/** The chosen name style: `?name=<variant>` wins on load, then the stored choice, else "original". */
export function useNameStyle(): [NameVariant, (v: NameVariant) => void] {
  const [style, setStyle] = useState<NameVariant>("original");

  // Read after mount: the server render can't see the URL's query or localStorage.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("name");
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {}
    const initial = isVariant(fromUrl) ? fromUrl : isVariant(stored) ? stored : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only state once, after hydration
    if (initial) setStyle(initial);
  }, []);

  const choose = (v: NameVariant) => {
    setStyle(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {}
  };
  return [style, choose];
}

/** A small pill of radio buttons, bottom-left of the centre row (above the readout, clear of the dial). */
export function NameStylePicker({
  value,
  onChange,
  hidden,
}: {
  value: NameVariant;
  onChange: (v: NameVariant) => void;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <div
      role="radiogroup"
      aria-label="Name style"
      className="absolute bottom-1 left-3 z-[5] flex items-center rounded-full border border-white/10 bg-[rgba(10,10,10,0.7)] p-0.5 text-[11px] uppercase tracking-[0.1em] backdrop-blur-[6px] md:left-8 md:text-xs min-[1440px]:left-16"
    >
      <span aria-hidden="true" className="hidden pl-3 pr-1 text-muted md:inline">
        Name style
      </span>
      {STYLES.map((s) => (
        <label
          key={s.value}
          className={`grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full px-2 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent md:px-3 ${
            value === s.value ? "bg-foreground text-background" : "text-muted hover:text-foreground"
          }`}
        >
          <input
            type="radio"
            name="reizdio-name-style"
            value={s.value}
            checked={value === s.value}
            onChange={() => onChange(s.value)}
            className="sr-only"
          />
          {s.label}
        </label>
      ))}
    </div>
  );
}
