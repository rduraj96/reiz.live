"use client";

import { useEffect, useState } from "react";
import { AboutPanel } from "@/components/AboutPanel";
import { BigName } from "@/components/BigName";
import { Intro } from "@/components/Intro";
import { Header } from "@/components/Header";
import { LoginDialog } from "@/components/LoginDialog";
import { Readout } from "@/components/Readout";
import { StationPanel } from "@/components/StationPanel";
import { Toast } from "@/components/Toast";
import { Tuner, tunerApi } from "@/components/Tuner";
import { Visualizer } from "@/components/Visualizer";
import { useDialBands } from "@/hooks/useDialBands";
import { togglePlay, useEngineBridge } from "@/hooks/useEngineBridge";
import { useReadoutState } from "@/hooks/useReadoutState";
import type { Station } from "@/lib/radio/types";
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
        className="relative z-[2] grid aspect-square w-[min(70vw,360px)] max-w-full cursor-pointer place-items-center rounded-full [grid-area:1/1] focus-visible:outline-offset-[-6px]"
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
  const readout = useReadoutState();

  const openPanel = usePlayer((s) => s.openPanel);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <div className="relative flex h-dvh w-full select-none flex-col overflow-hidden">
      <Header
        onSearch={() => openPanel("search")}
        onSaved={() => openPanel("saved")}
        onInfo={() => setAboutOpen(true)}
      />
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="relative grid min-h-0 flex-1 place-items-center">
          <BigName />
          <BlobButton />
        </div>
        <Readout {...readout} />
        <Tuner offDial={initialStation ? { station: initialStation, label: "Shared" } : undefined} />
      </main>

      <StationPanel />
      <AboutPanel open={aboutOpen} onOpenChange={setAboutOpen} />
      <LoginDialog />
      <Toast />
      <Intro />
    </div>
  );
}
