import { Slider } from "@/components/ui/slider";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PlayIcon,
  PauseIcon,
  Volume2,
  VolumeX,
  List,
  Loader2,
  Heart,
  HeartOff,
} from "lucide-react";
import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactCountryFlag from "react-country-flag";
import StationListModal from "./StationListModal";
import { useStationContext } from "../contexts/StationContext";
import { useAudioContext } from "@/contexts/AudioContext";

const PlayBar: React.FC = () => {
  const {
    savedStations,
    handleSave,
    handleRemove,
    currentStation,
    selectStation,
    stations,
    isPlaying,
    setPlaying,
    isMuted,
    toggleMute,
    searching,
  } = useStationContext();

  const { audioElementRef } = useAudioContext();
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimeRef = useRef<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = Date.now() - elapsedTime * 1000;
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - lastTimeRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying]);

  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(1, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }, []);

  const handlePlayPause = async () => {
    if (currentStation) {
      try {
        if (isPlaying) {
          await audioElementRef.current?.pause();
        } else {
          await audioElementRef.current?.play();
        }
        setPlaying(!isPlaying);
      } catch (error) {
        console.error("Error toggling play/pause:", error);
        // Optionally, update the UI to reflect the actual state
        setPlaying(audioElementRef.current?.paused === false);
      }
    }
  };

  return (
    <div className="absolute bottom-0 h-16 w-full trans text-foreground text-xl text-center flex items-center border-t-[1px] border-muted-foreground font-neue">
      <div className="h-full hidden md:flex items-center justify-center px-7">
        {currentStation ? (
          <ReactCountryFlag
            countryCode={currentStation.countryCode}
            svg
            aria-label={currentStation.countryCode}
            title={currentStation.countryCode}
          />
        ) : (
          <div className="w-6 h-4 bg-gray-700" />
        )}
      </div>
      <div className="h-full bg-muted-foreground w-[1px]" />
      <div className="w-72 flex items-center justify-center text-2xl font-light text-gray-200">
        {currentStation ? (
          <HoverCard>
            <HoverCardTrigger className="relative flex overflow-x-hidden">
              <a href={currentStation.homepage} target="_blank" className="">
                <div className="animate-marquee whitespace-nowrap uppercase">
                  <span className="mx-2">{currentStation.name}</span>
                  <span className="mx-2">{currentStation.name}</span>
                </div>
                <div className="absolute top-0 animate-marquee2 whitespace-nowrap uppercase">
                  <span className="mx-2">{currentStation.name}</span>
                  <span className="mx-2">{currentStation.name}</span>
                </div>
              </a>
            </HoverCardTrigger>
            <HoverCardContent className="bg-background text-foreground border-none shadow-none flex justify-center gap-3">
              <div>
                <Avatar>
                  <AvatarImage src={currentStation.favicon} />
                  <AvatarFallback>{currentStation.name}</AvatarFallback>
                </Avatar>
              </div>
              <div>
                <h3 className="text-base font-semibold whitespace-normal">
                  {currentStation.name}
                </h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {currentStation.tags}
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentStation.language}
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        ) : (
          <span className="text-gray-500">No station selected</span>
        )}
      </div>
      <div className="h-full bg-muted-foreground w-[1px]" />
      <div className="h-full flex items-center justify-center px-7">
        <button onClick={toggleMute} disabled={!currentStation}>
          {isMuted ? (
            <VolumeX
              className={`h-6 w-6 ${
                currentStation
                  ? "text-gray-200 hover:text-[#ee2647]"
                  : "text-gray-500"
              }`}
            />
          ) : (
            <Volume2
              className={`h-6 w-6 ${
                currentStation
                  ? "text-gray-200 hover:text-[#ee2647]"
                  : "text-gray-500"
              }`}
            />
          )}
        </button>
      </div>
      <div className="h-full bg-muted-foreground w-[1px]" />
      <div className="h-full flex items-center justify-between flex-1 text-center space-x-4 px-7">
        <button onClick={handlePlayPause} disabled={!currentStation}>
          {isPlaying ? (
            <PauseIcon
              className={`h-7 w-7 ${
                currentStation
                  ? "fill-gray-200 text-foreground hover:text-[#ee2647] hover:fill-[#ee2647]"
                  : "fill-gray-500 text-gray-500"
              }`}
            />
          ) : (
            <PlayIcon
              className={`h-7 w-7 ${
                currentStation
                  ? "fill-gray-200 text-foreground hover:text-[#ee2647] hover:fill-[#ee2647]"
                  : "fill-gray-500 text-gray-500"
              }`}
            />
          )}
        </button>
        <Slider
          defaultValue={[1]}
          max={1}
          step={1}
          className="w-full hidden md:flex"
          disabled={!currentStation}
        />
        <div className="whitespace-nowrap text-muted-foreground text-base hidden sm:block">
          {currentStation ? (
            <>
              {formatTime(elapsedTime)} /{" "}
              <span className="text-[#ee2647] font-semibold font-neue">
                Live
              </span>
            </>
          ) : (
            <span className="text-gray-500">--:--:-- / --:--:--</span>
          )}
        </div>
      </div>
      <div className="h-full bg-muted-foreground w-[1px]" />
      <div className="h-full px-7 flex items-center justify-center">
        {currentStation ? (
          <button
            disabled={!currentStation}
            onClick={(e) => {
              e.stopPropagation();
              if (currentStation) {
                savedStations.some(
                  (s) => s.urlResolved === currentStation.urlResolved
                )
                  ? handleRemove(currentStation)
                  : handleSave(currentStation);
              }
            }}
            className="text-gray-400 hover:text-foreground transition-colors"
          >
            <Heart
              size={18}
              fill={
                savedStations.some(
                  (s) => s.urlResolved === currentStation?.urlResolved
                )
                  ? "#ffffff"
                  : "none"
              }
            />
          </button>
        ) : (
          <div className="text-gray-500">
            <HeartOff />
          </div>
        )}
      </div>
      <div className="h-full bg-muted-foreground w-[1px]" />
      <div className="h-full px-7 flex items-center justify-center">
        {searching ? (
          <Loader2 className="h-6 w-6 text-gray-200 animate-spin" />
        ) : (
          <button onClick={() => setIsModalOpen(true)}>
            <List className="h-6 w-6 text-gray-200 hover:text-[#ee2647]" />
          </button>
        )}
      </div>
      {isModalOpen && (
        <StationListModal onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
};

export default PlayBar;
