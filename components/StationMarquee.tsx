import type { Station } from "@/lib/radio/types";

/** Scrolling uppercase station name; links to the station homepage when known. */
export function StationMarquee({ station }: { station: Station }) {
  const text = (
    <>
      <span className="mx-2">{station.name}</span>
      <span className="mx-2" aria-hidden="true">
        {station.name}
      </span>
    </>
  );
  const body = (
    <>
      <div className="animate-marquee whitespace-nowrap uppercase">{text}</div>
      <div className="absolute top-0 animate-marquee2 whitespace-nowrap uppercase" aria-hidden="true">
        {text}
      </div>
    </>
  );
  return (
    <div className="relative flex overflow-x-hidden">
      {station.homepage ? (
        <a href={station.homepage} target="_blank" rel="noopener noreferrer">
          {body}
        </a>
      ) : (
        <div>{body}</div>
      )}
    </div>
  );
}
