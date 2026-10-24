"use client";

import { stagger, staggerClass } from "./Takeover";

export type Country = { code: string; name: string };

type SearchBarProps = {
  q: string;
  onQ: (q: string) => void;
  country: string | null;
  onCountry: (code: string | null) => void;
  countries: Country[];
  inputRef?: React.Ref<HTMLInputElement>;
};

/** Giant-type search field with a quiet country filter beneath it. */
export function SearchBar({ q, onQ, country, onCountry, countries, inputRef }: SearchBarProps) {
  return (
    <div className={`mb-4 ${staggerClass}`} style={stagger(1)}>
      <input
        ref={inputRef}
        type="search"
        aria-label="Search stations"
        placeholder="Station or genre"
        value={q}
        onChange={(e) => onQ(e.target.value)}
        className="w-full appearance-none border-b border-[hsl(0_0%_15%)] bg-transparent pb-1 text-[clamp(32px,7vw,72px)] font-light leading-[1.25] tracking-[-0.03em] text-foreground outline-none focus-visible:outline-none placeholder:text-[hsl(0_0%_29%)] focus:border-accent [&::-webkit-search-cancel-button]:appearance-none"
      />
      <label className="mt-2 inline-flex min-h-11 items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted">
        <span aria-hidden="true">Country</span>
        <select
          aria-label="Country"
          value={country ?? ""}
          onChange={(e) => onCountry(e.target.value || null)}
          className="min-h-11 cursor-pointer appearance-none bg-transparent [field-sizing:content] text-[11px] uppercase tracking-[0.16em] text-foreground outline-none focus-visible:outline-2 focus-visible:outline-accent"
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="text-foreground">▾</span>
      </label>
    </div>
  );
}
