"use client";

import { Takeover, stagger, staggerClass } from "./Takeover";

const text = "max-w-[32ch] text-[clamp(18px,2.4vw,26px)] leading-[1.45] text-[hsl(0_0%_90%)]";

export function AboutPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Takeover
      open={open}
      onOpenChange={onOpenChange}
      title="About"
      description={
        <div className="flex flex-col gap-5">
          <p className={`${text} ${staggerClass}`} style={stagger(0)}>
            REIZDIO is free live radio. Use the tuner to tune through genres on the dial, or search for a station and
            save the ones you love.
          </p>
          <p className={`${text} ${staggerClass}`} style={stagger(1)}>
            The blob in the middle is a liquid chrome visualizer that moves to the music. Stations come from the
            community-run Radio Browser directory, and only streams the visualizer can read are listed.
          </p>
          <p className={`${text} ${staggerClass}`} style={stagger(2)}>
            Built by Rei Duraj.
          </p>
        </div>
      }
    >
      <a
        href="https://github.com/rduraj96/reiz.live"
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-8 inline-flex min-h-12 items-center rounded-full border border-foreground px-6 text-[13px] uppercase tracking-[0.12em] transition-colors hover:border-accent hover:text-accent ${staggerClass}`}
        style={stagger(3)}
      >
        GitHub ↗
      </a>
    </Takeover>
  );
}
