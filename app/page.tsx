"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AudioVizualizerBlob from "./(components)/AudioVizualizerBlob";
import { AnimatePresence, motion } from "framer-motion";
import { RandomReveal } from "react-random-reveal"; // import Typed from "react-typed";
import { RadioStation } from "./types";
import DarkSide from "./(components)/DarkSide";
import { SelectGroup } from "@radix-ui/react-select";
import ReactCountryFlag from "react-country-flag";

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
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
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

    if (selectedGenre) {
      fetchStations();
    }

    return () => {};
  }, [selectedRegion, selectedGenre]);

  const selectStation = (station: RadioStation) => {
    setCurrentStation(station);
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
              className="hidden md:block absolute top-0 left-1/2 transform -translate-x-1/2 mt-20"
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
                  onComplete={() => ({ shouldRepeat: true, delay: 5 })}
                />
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, type: "" }}
              className="flex flex-col gap-5 space-y-3 w-fit absolute md:top-1/2 md:left-[15%] md:transform md:-translate-y-1/2 md:ml-10 top-5 left-5"
            >
              <div className="text-gray-200">{`[ BROWSE ]`}</div>

              <Select
                value={selectedGenre}
                onValueChange={setSelectedGenre}
                // defaultValue="Genre"
              >
                <SelectTrigger className="text-gray-200 border-none focus:ring-0 w-28">
                  <SelectValue placeholder="Genre" />
                </SelectTrigger>
                <SelectContent className="overflow-scroll">
                  <SelectGroup>
                    <SelectLabel>Genres</SelectLabel>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="hip hop">Hip Hop</SelectItem>
                    <SelectItem value="dance">Dance</SelectItem>
                    <SelectItem value="rock">Rock</SelectItem>
                    <SelectItem value="pop">Pop</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              {stations.length !== 0 && (
                <Select
                  value={currentStation?.urlResolved || ""}
                  onValueChange={(e) =>
                    selectStation(
                      stations.find((station) => station.urlResolved === e)!
                    )
                  }
                >
                  <SelectTrigger className="mb-4 my-3 text-gray-200 w-32 line-clamp-1 whitespace-nowrap">
                    <SelectValue placeholder="Station" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Available Stations</SelectLabel>
                      {stations.map((station, i) => (
                        <SelectItem
                          key={station.urlResolved}
                          value={station.urlResolved}
                        >
                          {/* {`Station #${i + 1}`} */}
                          {station.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </motion.div>

            {currentStation && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, type: "tween" }}
                className="absolute md:top-1/2 md:right-[15%] md:transform md:-translate-y-1/2 md:mr-10 top-5 right-5"
              >
                <div className="flex flex-col gap-3 text-gray-400 text-md overflow-x-hidden">
                  <div className="text-gray-200">{`[ NOW PLAYING ]`}</div>
                  <div className="relative flex gap-2 items-center justify-between mb-2 w-36">
                    <div className="whitespace-nowrap animate-marquee">
                      {currentStation.name}
                    </div>
                  </div>
                  <div>{`Bitrate ${currentStation.bitrate} kbps`}</div>
                  <div className="flex gap-3">
                    {`Country`}
                    <span>
                      <ReactCountryFlag
                        countryCode={currentStation.countryCode}
                        svg
                        aria-label={currentStation.country}
                        title={currentStation.countryCode}
                      />
                    </span>
                  </div>
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
