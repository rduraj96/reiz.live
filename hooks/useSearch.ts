"use client";

import { useEffect, useState } from "react";
import type { Station } from "@/lib/radio/types";

const UNAVAILABLE = "Radio directory unavailable";
const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

type Settled = { key: string; results: Station[] | null; error: string | null };

/** Debounced station search. `results` is null while the query is too short to search. */
export function useSearch(q: string, country: string | null) {
  const query = q.trim();
  const active = query.length >= MIN_LENGTH;
  const key = `${query}|${country ?? ""}`;
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (query.length < MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query });
      if (country) params.set("country", country);
      fetch(`/api/stations/search?${params}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as { error?: string } | null;
            throw new Error(body?.error ?? UNAVAILABLE);
          }
          return (await res.json()) as Station[];
        })
        .then((results) => {
          if (!controller.signal.aborted) setSettled({ key, results, error: null });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setSettled({ key, results: null, error: err instanceof Error ? err.message : UNAVAILABLE });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, country, key]);

  if (!active) return { results: null, loading: false, error: null };
  const current = settled?.key === key;
  return {
    // Keep showing the previous results while a newer query is in flight.
    results: current ? settled.results : (settled?.error ? null : (settled?.results ?? null)),
    loading: !current,
    error: current ? settled.error : null,
  };
}
