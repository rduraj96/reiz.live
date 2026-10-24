import { useSyncExternalStore } from "react";
import type { Station } from "@/lib/radio/types";
import { isStation } from "./recents";

// Saved stations live in this browser only: no accounts.
const KEY = "reizdio:saved";
const MAX = 500;
const EMPTY: Station[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedList: Station[] = EMPTY;
// When storage refuses writes, the list lives here for the rest of the visit.
let memory: Station[] | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Station[] {
  if (!raw) return EMPTY;
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isStation).slice(0, MAX) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Parsed list; the same array reference is returned until the stored value changes. */
function snapshot(): Station[] {
  if (memory) return memory;
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = parse(raw);
  }
  return cachedList;
}

const emit = () => listeners.forEach((l) => l());

export function isSaved(id: string): boolean {
  return snapshot().some((s) => s.id === id);
}

/** Saves the station (newest first), or removes it if it's already saved. */
export function toggleSaved(s: Station): void {
  const list = snapshot();
  const next = list.some((x) => x.id === s.id) ? list.filter((x) => x.id !== s.id) : [s, ...list].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    memory = next;
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab saved or removed a station.
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSaved(): Station[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
