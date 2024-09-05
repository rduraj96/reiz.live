import { Slider } from "@/components/ui/slider";
import { Pause, Play, Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import React, { useEffect, useState } from "react";

type Props = {
  audioElement: HTMLAudioElement;
  playing: boolean;
};

const AudioControls = ({ audioElement, playing }: Props) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(100);

  useEffect(() => {
    setIsPlaying(playing);
  }, [playing]);

  const handleMediaControl = () => {
    if (!audioElement.paused) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      audioElement.play();
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (newValue: number[]) => {
    const newVolume = newValue[0] / 100;
    setVolume(newValue[0]);
    audioElement.volume = newVolume;
  };

  return (
    <div className="absolute z-10 left-1/2 bottom-[10%] sm:bottom-0 sm:mb-10 flex justify-between items-center gap-10 -translate-x-1/2 -translate-y-1/2 text-foreground">
      {/* <h3 className="font-bold">PREV</h3> */}
      <button
        onClick={() => {
          handleMediaControl();
        }}
        className="hover:cursor-pointer text-foreground"
      >
        {!isPlaying ? <Pause size={56} /> : <Play size={56} />}
      </button>
      {/* <h3 className="font-bold">NEXT</h3> */}
      <div className="flex gap-2">
        <div
          className="hover:cursor-pointer"
          onClick={() => {
            if (volume === 0) {
              handleVolumeChange([50]);
            } else {
              handleVolumeChange([0]);
            }
          }}
        >
          {volume === 0 && <VolumeX />}
          {volume > 0 && volume <= 25 && <Volume />}
          {volume > 25 && volume <= 75 && <Volume1 />}
          {volume > 75 && <Volume2 />}
        </div>
        <Slider
          value={[volume]}
          onValueChange={handleVolumeChange}
          min={0}
          max={100}
          step={1}
          aria-label="Volume Control"
          className="w-40"
        />
      </div>
    </div>
  );
};

export default AudioControls;
