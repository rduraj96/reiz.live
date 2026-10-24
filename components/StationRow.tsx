import { flagEmoji } from "@/lib/flag";
import type { Station } from "@/lib/radio/types";

type StationRowProps = {
  station: Station;
  active: boolean;
  onSelect: () => void;
};

export function StationRow({ station, active, onSelect }: StationRowProps) {
  const flag = flagEmoji(station.countryCode);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active || undefined}
        className={`w-full min-h-14 p-3 rounded-lg border flex items-center gap-4 text-left transition-colors ${
          active
            ? "bg-foreground text-background border-accent"
            : "border-transparent text-foreground hover:border-foreground"
        }`}
      >
        {station.favicon ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary third-party favicons
          <img
            src={station.favicon}
            alt=""
            width={32}
            height={32}
            loading="lazy"
            className="size-8 shrink-0 rounded object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="size-8 shrink-0 rounded bg-muted/30 flex items-center justify-center font-bold uppercase"
          >
            {station.name.trim().charAt(0)}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-lg font-medium">{station.name}</span>
        {flag && (
          <span role="img" aria-label={station.country} title={station.country} className="text-xl">
            {flag}
          </span>
        )}
      </button>
    </li>
  );
}
