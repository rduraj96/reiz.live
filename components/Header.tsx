"use client";

import { LanguageSwitch } from "./LanguageSwitch";

type HeaderProps = {
  onSearch: () => void;
  onSaved: () => void;
  onInfo: () => void;
};

const chip =
  "min-h-11 min-w-11 px-[7px] min-[760px]:px-3 rounded-full flex items-center justify-center whitespace-nowrap " +
  "text-[13px] uppercase tracking-[0.02em] text-muted transition-colors hover:text-foreground cursor-pointer";

/** Top bar: the REIZDIO wordmark, then the language switch and the SEARCH / SAVED / INFO text buttons. */
export function Header({ onSearch, onSaved, onInfo }: HeaderProps) {
  return (
    <header className="relative z-30 flex items-center justify-between gap-2 px-4 py-3.5 min-[760px]:px-8 min-[760px]:py-[26px]">
      <h1 className="text-[22px] font-bold tracking-[-0.03em] text-foreground min-[760px]:text-[28px]">REIZDIO</h1>
      <nav aria-label="Main" className="flex items-center gap-0.5">
        <LanguageSwitch className={chip} />
        <button type="button" className={chip} data-panel-opener="browse" onClick={onSearch}>
          SEARCH
        </button>
        <button type="button" className={chip} data-panel-opener="saved" onClick={onSaved}>
          SAVED
        </button>
        <button type="button" className={chip} onClick={onInfo}>
          INFO
        </button>
      </nav>
    </header>
  );
}
