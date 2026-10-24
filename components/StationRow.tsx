import type { Station } from "@/lib/radio/types";
import { HeartButton } from "./HeartButton";
import { stagger, staggerClass } from "./Takeover";

type StationRowProps = {
  station: Station;
  /** Position in the list: numbers the row and staggers its entrance. */
  index: number;
  active: boolean;
  onSelect: () => void;
};

export function StationRow({ station, index, active, onSelect }: StationRowProps) {
  const meta = [station.tags[0], station.countryCode].filter(Boolean).join(" · ");
  return (
    <li className={`group flex items-center border-b border-[hsl(0_0%_10%)] ${staggerClass}`} style={stagger(index + 2)}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active || undefined}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-4 py-2 text-left min-[760px]:gap-6"
      >
        <span aria-hidden="true" className="w-7 shrink-0 text-xs tabular-nums tracking-[0.1em] text-accent">
          {active ? "●" : String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[22px] font-bold uppercase leading-tight tracking-[-0.03em] transition-colors min-[760px]:text-[40px] ${
              active ? "text-foreground" : "text-[hsl(0_0%_54%)] group-hover:text-foreground"
            }`}
          >
            {station.name}
          </span>
          {meta && <span className="mt-0.5 block text-[11px] uppercase tracking-[0.14em] text-muted">{meta}</span>}
        </span>
      </button>
      <HeartButton
        station={station}
        className="flex size-11 shrink-0 items-center justify-center text-muted transition-colors hover:text-foreground aria-pressed:text-accent"
      />
    </li>
  );
}
