"use client";

import { useEffect, useRef, useState } from "react";
import { togglePlay } from "@/hooks/useEngineBridge";
import { useSearch } from "@/hooks/useSearch";
import { useRecents } from "@/lib/library/recents";
import type { Station } from "@/lib/radio/types";
import { signOut, useAuth } from "@/store/auth";
import { usePlayer, type PanelTab } from "@/store/player";
import { SearchBar, type Country } from "./SearchBar";
import { StationRow } from "./StationRow";
import { Takeover, stagger, staggerClass } from "./Takeover";

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
   * nothing loaded yet) it is primed so the first tap on the blob starts it. A loaded station that failed (idle,
   * not primed, still current) counts as started. The Tuner follows `current` itself.
   */
  function pick(station: Station, stations: Station[]) {
    const { primed, status, current, setList, select, prime } = usePlayer.getState();
    if (station.id === current?.id && (status === "paused" || status === "blocked" || status === "idle")) {
      // select() ignores the current station, so resume it directly (this also loads a primed one).
      togglePlay();
    } else if (!primed && (status !== "idle" || current !== null)) {
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
    if (stations.length === 0) return <Note>{empty}</Note>;
    return (
      <ul>
        {stations.map((station, i) => (
          <StationRow
            key={station.id}
            index={i}
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
      if (!searching) return <Note>Type at least two letters to search</Note>;
      if (search.error) return <Note>{search.error}</Note>;
      if (search.results === null) return <Note>Searching…</Note>;
      return renderStations(search.results, "No stations found");
    }
    if (tab === "recent") return renderStations(recents, "Nothing played yet");
    if (!user) return <Note>Log in to save stations</Note>;
    return renderStations(saved, "No saved stations yet");
  }

  return (
    <Takeover
      open={open}
      onOpenChange={(o) => !o && closePanel()}
      title={TABS.find((t) => t.id === tab)!.label}
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
    >
      <div role="tablist" aria-label="Station lists" className={`mb-2 flex gap-5 ${staggerClass}`}>
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
              className={`flex min-h-11 items-center gap-1.5 text-xs uppercase tracking-[0.16em] transition-colors ${
                selected ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              <span aria-hidden="true" className={`size-1.5 rounded-full bg-accent ${selected ? "" : "invisible"}`} />
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id="panel-tabpanel" aria-labelledby={`panel-tab-${tab}`} key={tab}>
        {tab === "search" && (
          <SearchBar q={q} onQ={setQ} country={country} onCountry={setCountry} countries={countries} inputRef={searchRef} />
        )}
        {body()}
        {tab === "saved" && (
          <div className={`mt-8 ${staggerClass}`} style={stagger(4)}>
            <button
              type="button"
              onClick={() => (user ? void signOut() : openLogin())}
              className="min-h-12 rounded-full border border-foreground px-6 text-[13px] uppercase tracking-[0.12em] transition-colors hover:border-accent hover:text-accent"
            >
              {user ? "Log out" : "Log in"}
            </button>
          </div>
        )}
      </div>
    </Takeover>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className={`py-4 text-base text-muted ${staggerClass}`}>{children}</p>;
}
