"use client";

export type Country = { code: string; name: string };

type SearchBarProps = {
  q: string;
  onQ: (q: string) => void;
  country: string | null;
  onCountry: (code: string | null) => void;
  countries: Country[];
  inputRef?: React.Ref<HTMLInputElement>;
};

const field = "min-h-11 w-full border border-muted bg-background px-3 text-foreground focus:border-accent outline-none";

export function SearchBar({ q, onQ, country, onCountry, countries, inputRef }: SearchBarProps) {
  return (
    <div className="mb-3 flex flex-col gap-2">
      <input
        ref={inputRef}
        type="search"
        aria-label="Search stations"
        placeholder="Search stations"
        value={q}
        onChange={(e) => onQ(e.target.value)}
        className={field}
      />
      <select
        aria-label="Country"
        value={country ?? ""}
        onChange={(e) => onCountry(e.target.value || null)}
        className={field}
      >
        <option value="">All countries</option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
