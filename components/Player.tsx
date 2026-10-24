"use client";

import { useEffect, useState } from "react";
import { AboutPanel } from "@/components/AboutPanel";
import { AmbientControls } from "@/components/AmbientControls";
import { BigName } from "@/components/BigName";
import { Intro } from "@/components/Intro";
import { GenreStrip } from "@/components/GenreStrip";
import { Header } from "@/components/Header";
import { Readout } from "@/components/Readout";
import { StationPanel } from "@/components/StationPanel";
import { Toast } from "@/components/Toast";
import { Tuner, tunerApi } from "@/components/Tuner";
import { Visualizer } from "@/components/Visualizer";
import { useDialBands } from "@/hooks/useDialBands";
import { togglePlay, useEngineBridge } from "@/hooks/useEngineBridge";
import { useAmbientMode } from "@/hooks/useAmbientMode";
import { useNowPlaying } from "@/hooks/useNowPlaying";
import { useReadoutState } from "@/hooks/useReadoutState";
import type { Station } from "@/lib/radio/types";
import { useAmbient } from "@/store/ambient";
import { usePlayer } from "@/store/player";

/**
 * The chrome blob is the play/pause button. "Tap to play" shows whenever the stream isn't playing; it is
 * overlaid on the button rather than inside it, so the button's name ("Play") matches its content (axe).
 */
function BlobButton() {
  const playing = usePlayer((s) => s.status === "playing");
  return (
    <>
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => {
          // Nothing tuned yet (the first band loaded late, or after Retry): tune to the station under the needle.
          if (usePlayer.getState().current) togglePlay();
          else tunerApi.tuneNearest();
        }}
        className="relative z-[2] grid aspect-square w-[var(--blob)] max-w-full cursor-pointer place-items-center rounded-full group-data-[idle]/player:cursor-none [grid-area:1/1] focus-visible:outline-offset-[-6px]"
      >
        <Visualizer />
      </button>
      <span
        aria-hidden="true"
        className={`pointer-events-none relative z-[4] rounded-full bg-[rgba(10,10,10,0.55)] px-3 py-2 text-xs uppercase tracking-[0.14em] backdrop-blur-[6px] transition-[opacity,visibility] duration-300 [grid-area:1/1] ${playing ? "invisible opacity-0" : "opacity-100"}`}
      >
        Tap to play
      </span>
    </>
  );
}

/** One full-height stage: header, then the big name behind the blob, the readout and the tuner dial. */
export function Player({ initialStation }: { initialStation?: Station }) {
  // Must run before the bridge's mount effect so the primed station isn't auto-loaded.
  useEffect(() => {
    if (initialStation) usePlayer.getState().prime(initialStation);
  }, [initialStation]);
  useEngineBridge();
  useDialBands();
  useNowPlaying();
  useAmbientMode();
  const ambient = useAmbient((s) => s.on);
  const idle = useAmbient((s) => s.idle);
  const readout = useReadoutState();

  const openPanel = usePlayer((s) => s.openPanel);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    // Ambient mode folds the header and the controls under the stage away (and hides them from tabbing), so the
    // stage takes the whole screen and the blob grows: no 360 px cap, and up to 80 % of the stage on wide screens.
    <div
      data-ambient={ambient || undefined}
      data-idle={(ambient && idle) || undefined}
      className="group/player relative flex h-dvh w-full select-none flex-col overflow-hidden data-[idle]:cursor-none"
    >
      <div className="grid transition-[grid-template-rows,opacity,visibility] duration-500 motion-reduce:transition-none grid-rows-[1fr] group-data-[ambient]/player:invisible group-data-[ambient]/player:grid-rows-[0fr] group-data-[ambient]/player:opacity-0">
        <div className="min-h-0 overflow-hidden">
          <Header
            onSearch={() => openPanel("search")}
            onSaved={() => openPanel("saved")}
            onInfo={() => setAboutOpen(true)}
          />
        </div>
      </div>
      <main className="flex min-h-0 flex-1 flex-col">
        {/* The blob size fits the stage both ways: on phones the orbit ring (1.55 × blob) must clear a short screen too;
            from 760 px (the ticker, no ring) it grows with the screen up to 640 px. */}
        <div className="relative grid min-h-0 flex-1 place-items-center [container-type:size] [--blob:min(70cqw,360px,calc((100cqh-28px)/1.55))] min-[760px]:[--blob:min(60cqw,78cqh,640px)] group-data-[ambient]/player:[--blob:min(70cqw,calc((100cqh-28px)/1.55))] min-[760px]:group-data-[ambient]/player:[--blob:min(80cqw,80cqh)]">
          <BigName />
          <BlobButton />
        </div>
        <div className="grid transition-[grid-template-rows,opacity,visibility] duration-500 motion-reduce:transition-none grid-rows-[1fr] group-data-[ambient]/player:invisible group-data-[ambient]/player:grid-rows-[0fr] group-data-[ambient]/player:opacity-0">
          <div className="min-h-0 overflow-hidden">
            <Readout {...readout} />
            <GenreStrip />
            <Tuner offDial={initialStation ? { station: initialStation, label: "Shared" } : undefined} />
          </div>
        </div>
      </main>
      <AmbientControls />

      <StationPanel />
      <AboutPanel open={aboutOpen} onOpenChange={setAboutOpen} />
      <Toast />
      <Intro />
    </div>
  );
}
