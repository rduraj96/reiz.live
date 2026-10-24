"use client";

import { useEffect, useId, useRef, useState } from "react";
import { languages } from "@/lib/catalog";
import { useDial } from "@/store/dial";
import { usePlayer } from "@/store/player";

const options = [{ value: "any", label: "Any" }, ...languages];

/** Header language switch: `LANG · ANY ▾` (`ANY ▾` below 760 px) opening a radiogroup popover. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const language = usePlayer((s) => s.language);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const popId = useId();

  const checked = Math.max(0, options.findIndex((o) => o.value === language));
  const current = options[checked];

  // Opening moves focus onto the checked option.
  useEffect(() => {
    if (open) optionRefs.current[checked]?.focus();
  }, [open, checked]);

  // A pointer press outside closes it.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const choose = (value: string) => {
    if (value !== usePlayer.getState().language) {
      usePlayer.getState().setLanguage(value);
      useDial.getState().resetForLanguage(value);
    }
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    const focused = optionRefs.current.findIndex((el) => el === document.activeElement);
    if (step !== undefined && focused >= 0) {
      e.preventDefault();
      optionRefs.current[(focused + step + options.length) % options.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      optionRefs.current[e.key === "Home" ? 0 : options.length - 1]?.focus();
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        // Tabbing out of the switch closes the popover.
        if (open && e.relatedTarget && !wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setOpen((o) => !o)}
        className={`${className} aria-expanded:text-foreground`}
      >
        {/* One inline run, so the flex button doesn't trim the spaces between the parts. */}
        <span>
          <span aria-hidden="true" className="hidden min-[760px]:inline">
            Lang ·{" "}
          </span>
          <span className="sr-only">Language: </span>
          <span className="text-foreground">{current.label}</span>
          <span aria-hidden="true"> ▾</span>
        </span>
      </button>
      <div
        id={popId}
        role="radiogroup"
        aria-label="Language"
        hidden={!open}
        className="absolute right-0 top-full z-40 mt-1.5 min-w-[150px] rounded-[14px] border border-[hsl(0_0%_16%)] bg-[hsl(0_0%_8%)] p-1.5"
      >
        {options.map((o, i) => (
          <button
            key={o.value}
            ref={(el) => {
              optionRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={i === checked}
            tabIndex={i === checked ? 0 : -1}
            onClick={() => choose(o.value)}
            className="block min-h-11 w-full rounded-[9px] px-3 text-left text-sm normal-case tracking-normal text-muted hover:bg-[hsl(0_0%_12%)] hover:text-foreground aria-checked:text-foreground"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
