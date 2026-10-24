import type { SupabaseClient } from "@supabase/supabase-js";
import type { Station } from "@/lib/radio/types";

export const st = (id: string): Station => ({
  id,
  name: `Station ${id}`,
  streamUrl: `https://example.com/${id}`,
  homepage: null,
  favicon: null,
  country: "X",
  countryCode: "XX",
  language: "en",
  tags: [],
  codec: "MP3",
  bitrate: 128,
});

type Result = { data: unknown; error: { message: string } | null };

/** Chainable fake query builder recording calls; awaiting it yields `result`. */
export function fakeSb(result: Result = { data: [], error: null }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, unknown> = {
    then: (res: (r: Result) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej),
  };
  for (const m of ["select", "order", "upsert", "delete", "eq"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return builder;
    };
  }
  const sb = {
    from: (t: string) => {
      calls.push(["from", t]);
      return builder;
    },
  } as unknown as SupabaseClient;
  return { sb, calls };
}
