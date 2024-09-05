import React, { useEffect, useRef, useState } from "react";
import { setupThreeScene } from "./threeSetup";
import { useAudioSetup } from "@/hooks/useAudioHandler";
import PlayBar from "./PlayBar";
import { useStationContext } from "../contexts/StationContext";
import { AudioProvider } from "@/contexts/AudioContext";
const VisualizerBlob: React.FC = () => {
  const { currentStation, isPlaying, setPlaying, isMuted } =
    useStationContext();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);

  const { audioElementRef, analyserRef } = useAudioSetup(
    currentStation?.urlResolved ?? null,
    setPlaying,
    setAudioData
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    const cleanup = setupThreeScene(canvasRef.current, analyserRef);
    return cleanup;
  }, [analyserRef]);

  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.muted = isMuted;
    }
  }, [audioElementRef, isMuted]);

  return (
    <AudioProvider value={{ audioElementRef }}>
      <div className="relative flex flex-col justify-center w-full h-full ">
        <div ref={canvasRef} />
        <PlayBar />
      </div>
    </AudioProvider>
  );
};

export default VisualizerBlob;
