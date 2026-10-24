"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { togglePlay } from "@/hooks/useEngineBridge";
import { useSearch } from "@/hooks/useSearch";
import { useRecents } from "@/lib/library/recents";
import type { Station } from "@/lib/radio/types";
import { signOut, useAuth } from "@/store/auth";
import { usePlayer, type PanelTab } from "@/store/player";
import { SearchBar, type Country } from "./SearchBar";
import { StationRow } from "./StationRow";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "search", label: "Search" },
  { id: "recent", label: "Recent" },
  { id: "saved", label: "Saved" },
];

/** The visible control that opens `tab` (marked with data-panel-opener), for focus return. */
function visibleOpener(tab: PanelTab): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-panel-opener~="${tab}"]`);
  return Array.from(candidates).find((el) => el.getClientRects().length > 0) ?? null;
}

export function StationPanel() {
  const { open, tab } = usePlayer((s) => s.panel);
  const openPanel = usePlayer((s) => s.openPanel);
  const closePanel = usePlayer((s) => s.closePanel);
  const current = usePlayer((s) => s.current);
  const recents = useRecents();
  const saved = useAuth((s) => s.saved);
  const user = useAuth((s) => s.user);
  const openLogin = useAuth((s) => s.openLogin);
  const openerRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Record<PanelTab, HTMLButtonElement | null>>({ search: null, recent: null, saved: null });

  const [q, setQ] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const countriesLoaded = useRef(false);
  const search = useSearch(q, country);
  // A closed panel forgets its search, so reopening starts with an empty search.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setQ("");
  }
  const searching = q.trim().length >= 2;

  // Countries are fetched once, the first time the panel opens.
  useEffect(() => {
    if (!open || countriesLoaded.current) return;
    countriesLoaded.current = true;
    fetch("/api/countries")
      .then((res) => (res.ok ? (res.json() as Promise<Country[]>) : []))
      .then(setCountries)
      .catch(() => {
        countriesLoaded.current = false;
      });
  }, [open]);

  /**
   * Once the user has started audio, a pick becomes the play queue and plays. Before that (only primed, or
   * nothing playing yet) it is primed so the first tap on the blob starts it. The Tuner follows `current` itself.
   */
  function pick(station: Station, stations: Station[]) {
    const { primed, status, current, setList, select, prime } = usePlayer.getState();
    if (station.id === current?.id && (status === "paused" || status === "blocked" || status === "idle")) {
      // select() ignores the current station, so resume it directly (this also loads a primed one).
      togglePlay();
    } else if (!primed && status !== "idle") {
      setList(stations);
      select(station);
    } else {
      prime(station);
    }
    closePanel();
  }

  function onTabKeyDown(e: React.KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length].id;
    openPanel(next);
    tabRefs.current[next]?.focus();
  }

  function renderStations(stations: Station[], empty: string) {
    if (stations.length === 0) return <p className="text-muted">{empty}</p>;
    return (
      <ul className="space-y-2">
        {stations.map((station) => (
          <StationRow
            key={station.id}
            station={station}
            active={station.id === current?.id}
            onSelect={() => pick(station, stations)}
          />
        ))}
      </ul>
    );
  }

  function body() {
    if (tab === "search") {
      if (!searching) return <p className="text-muted">Type at least two letters to search</p>;
      if (search.error) return <p className="text-muted">{search.error}</p>;
      if (search.results === null) return <p className="text-muted">Searching…</p>;
      return renderStations(search.results, "No stations found");
    }
    if (tab === "recent") return renderStations(recents, "Nothing played yet");
    if (!user) return <p className="text-muted">Log in to save stations</p>;
    return renderStations(saved, "No saved stations yet");
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closePanel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Safari/Firefox leave activeElement on <body> after a mouse click, so fall back to the opening control.
            const active = document.activeElement;
            openerRef.current =
              active instanceof HTMLElement && active !== document.body && document.contains(active)
                ? active
                : visibleOpener(tab);
            // Search is for typing: land in the input rather than on the first tabbable control.
            if (tab === "search" && searchRef.current) {
              e.preventDefault();
              searchRef.current.focus();
            }
          }}
          onCloseAutoFocus={(e) => {
            // No Dialog.Trigger (opened via the store), so hand focus back to the opener ourselves.
            e.preventDefault();
            openerRef.current?.focus();
          }}
          className="fixed z-50 flex flex-col border border-muted bg-background p-4 text-foreground inset-x-0 bottom-0 h-[85dvh] md:inset-x-auto md:right-0 md:top-0 md:bottom-auto md:h-dvh md:w-[400px]"
        >
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-2xl font-bold tracking-tight">STATIONS</Dialog.Title>
            <Dialog.Close aria-label="Close" className="size-11 text-2xl text-muted hover:text-foreground">
              ×
            </Dialog.Close>
          </div>
          <div role="tablist" aria-label="Station lists" className="mb-3 flex border-b border-muted">
            {TABS.map((t, i) => {
              const selected = t.id === tab;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[t.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`panel-tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls="panel-tabpanel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => openPanel(t.id)}
                  onKeyDown={(e) => onTabKeyDown(e, i)}
                  className={`min-h-11 flex-1 border-b-2 text-lg ${
                    selected ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div role="tabpanel" id="panel-tabpanel" aria-labelledby={`panel-tab-${tab}`} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "search" && (
                <SearchBar
                  q={q}
                  onQ={setQ}
                  country={country}
                  onCountry={setCountry}
                  countries={countries}
                  inputRef={searchRef}
                />
              )}
              {body()}
            </div>
            {tab === "saved" && (
              <div className="mt-3 border-t border-muted pt-3">
                <button
                  type="button"
                  onClick={() => (user ? void signOut() : openLogin())}
                  className="min-h-11 border border-foreground px-4 text-foreground hover:border-accent"
                >
                  {user ? "Log out" : "Log in"}
                </button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
