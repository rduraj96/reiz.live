"use client";

import { useEffect, useRef } from "react";

type ChipRowProps = {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
};

/** Horizontally scrollable radio group of chips; keeps the selected chip in view. */
export function ChipRow({ label, options, value, onChange }: ChipRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!row || !chip) return;
    // Scroll the row only; scrollIntoView could also scroll the page.
    row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2, behavior: "smooth" });
  }, [value]);

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + step + options.length) % options.length];
    onChange(next.value);
    requestAnimationFrame(() => rowRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  }

  const selectedIndex = options.findIndex((o) => o.value === value);

  return (
    <div
      ref={rowRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="relative flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (selectedIndex < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-base whitespace-nowrap transition-colors ${
              selected ? "border-accent bg-accent text-foreground font-bold" : "border-muted text-gray-200"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
