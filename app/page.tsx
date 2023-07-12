"use client";

import React, { useEffect, useState, useRef } from "react";
import { RadioBrowserApi, Station } from "radio-browser-api";
import StationList from "./(components)/StationList";
import MediaPlayer from "./(components)/MediaPlayer";
import AsciiEffectScene from "./(components)/Scene";
import SpectogramVisualizer from "./(components)/SpectogramVisualizer";
import AudioVizualizerBlob from "./(components)/AudioVizualizerBlob";
import { AnimatePresence, motion } from "framer-motion";
import { RandomReveal } from "react-random-reveal"; // import Typed from "react-typed";
import { RadioStation } from "./types";
import DarkSide from "./(components)/DarkSide";

const appName = "Reizdio";

interface StationQueryParams {
  limit: number;
  order: "random";
  region?: string;
  tag?: string;
  language?: string;
}
export default function Home() {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [currentStation, setCurrentStation] = useState<RadioStation | null>(
    null
  );
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState<string>("house");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("english");
  const [showEgg, setShowEgg] = useState<boolean>(false);

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const response = await fetch(
          `/api/stations?limit=20&language=${selectedLanguage}&tag=${selectedGenre}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch stations");
        }

        const data = await response.json();
        setStations(data);
      } catch (error) {
        console.error("Error fetching stations:", error);
      }
    };

    fetchStations();

    return () => {
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.src = "";
      }
    };
  }, [selectedRegion, selectedGenre]);

  const selectStation = (station: RadioStation) => {
    setCurrentStation(station);

    // if (audioPlayer) {
    //   if (audioPlayer.src === stationUrl) {
    //     if (audioPlayer.paused) {
    //       audioPlayer.play();
    //     } else {
    //       audioPlayer.pause();
    //     }
    //   } else {
    //     audioPlayer.pause();
    //     audioPlayer.src = stationUrl;
    //     audioPlayer.play();
    //   }
    // }
  };

  const playStation = () => {
    if (audioPlayer && audioPlayer.paused) {
      audioPlayer.play();
    }
  };

  const pauseStation = () => {
    if (audioPlayer && !audioPlayer.paused) {
      audioPlayer.pause();
    }
  };

  return (
    <div className="relative h-screen max-h-screen bg-foreground">
      <AnimatePresence>
        {showEgg ? (
          <motion.div
            key="easter-egg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="easter-egg"
          >
            <DarkSide />
          </motion.div>
        ) : (
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, type: "keyframes" }}
            >
              <AudioVizualizerBlob
                stationURL={currentStation?.urlResolved || null}
              />
              {/* <AsciiEffectScene /> */}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, type: "tween" }}
              onClick={() => setShowEgg((prev) => !prev)}
              className="absolute top-0 left-1/2 transform -translate-x-1/2 mt-20"
            >
              <h1
                className="text-4xl text-gray-200 font-bold mb-6"
                suppressHydrationWarning
              >
                <RandomReveal
                  isPlaying
                  duration={2}
                  revealDuration={0.3}
                  characters="REiZ"
                  onComplete={() => ({ shouldRepeat: false })}
                />
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, type: "" }}
              className="flex flex-col gap-5 space-y-3 w-fit absolute top-1/2 left-[15%] transform -translate-y-1/2 ml-10"
            >
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="block w-fit p-2 bg-transparent text-gray-200 text-xl"
              >
                <option value="">{"[ All Regions ]"}</option>
                <option value="Africa">Africa</option>
                <option value="Asia">Asia</option>
                <option value="Europe">Europe</option>
              </select>

              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="block w-fit p-2 bg-transparent text-gray-200"
              >
                <option value="">All Genres</option>
                <option value="pop">Pop</option>
                <option value="rock">Rock</option>
                <option value="hip hop">Hip Hop</option>
                <option value="dance">Dance</option>
                <option value="house">House</option>
              </select>

              <StationList
                stations={stations}
                currentStation={currentStation}
                selectStation={selectStation}
              />
            </motion.div>

            {currentStation && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, type: "tween" }}
                className="absolute sm top-1/2 right-[15%] transform -translate-y-1/2 mr-10"
              >
                <div className="flex flex-col gap-3 text-gray-400 text-lg overflow-x-hidden">
                  <div className="text-gray-200">{`[ NOW PLAYING ]`}</div>
                  <div className="relative flex gap-2 items-center justify-between mb-2 w-36">
                    <div className="whitespace-nowrap animate-marquee">
                      {currentStation.name}
                    </div>
                  </div>
                  <div>{`.Bitrate ${currentStation.bitrate} kbps`}</div>
                  <div>{`.Country ${currentStation.country}`}</div>
                  <a href={currentStation.homepage} target="_blank">
                    Go to website
                  </a>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
