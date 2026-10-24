import { useSyncExternalStore } from "react";
import type { Station } from "@/lib/radio/types";

const KEY = "reizdio:recents";
const MAX = 20;
const EMPTY: Station[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedList: Station[] = EMPTY;

export function isStation(v: unknown): v is Station {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return typeof s.id === "string" && typeof s.name === "string" && typeof s.streamUrl === "string";
}

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
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = parse(raw);
  }
  return cachedList;
}

function emit() {
  listeners.forEach((l) => l());
}

export function loadRecents(): Station[] {
  return snapshot();
}

export function addRecent(s: Station): Station[] {
  const next = [s, ...snapshot().filter((r) => r.id !== s.id)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable or full: keep the in-memory result.
    cachedRaw = readRaw();
    cachedList = next;
  }
  emit();
  return next;
}

export function clearRecents(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  cachedRaw = null;
  cachedList = EMPTY;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useRecents(): Station[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
