"use client";

import React, { useEffect, useState, useRef } from "react";
import { RadioBrowserApi, Station } from "radio-browser-api";
import StationList from "./(components)/StationList";
import MediaPlayer from "./(components)/MediaPlayer";
import AsciiEffectScene from "./(components)/Scene";
import SpectogramVisualizer from "./(components)/SpectogramVisualizer";
import AudioVizualizerBlob from "./(components)/AudioVizualizerBlob";
import { motion } from "framer-motion";
import ReactTypingEffect from "react-typing-effect";
// import Typed from "react-typed";

const appName = "Reizdio";

interface RadioStation {
  name: string;
  url: string;
}

interface StationQueryParams {
  limit: number;
  order: "random";
  region?: string;
  tag?: string;
  language?: string;
}
export default function Home() {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [currentStation, setCurrentStation] = useState<string | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState<string>("house");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("english");

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

  const selectStation = (stationUrl: string) => {
    setCurrentStation(stationUrl);

    if (audioPlayer) {
      if (audioPlayer.src === stationUrl) {
        if (audioPlayer.paused) {
          audioPlayer.play();
        } else {
          audioPlayer.pause();
        }
      } else {
        audioPlayer.pause();
        audioPlayer.src = stationUrl;
        audioPlayer.play();
      }
    }
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
    <div className="w-screen max-h-screen bg-foreground relative">
      <motion.div
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1 }}
      >
        <AudioVizualizerBlob stationURL={currentStation} />
        {/* <AsciiEffectScene /> */}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1 }}
        className="fixed m-10 top-0 left-0"
      >
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="text-4xl text-gray-200 font-bold mb-6"
        >
          <ReactTypingEffect
            staticText="REiZ"
            text=".live"
            className="tracking-light"
          />
        </motion.h1>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="flex flex-col gap-5 space-y-3"
        >
          <motion.select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="block w-full p-2 bg-transparent text-gray-200"
          >
            <option value="">All Regions</option>
            <option value="Africa">Africa</option>
            <option value="Asia">Asia</option>
            <option value="Europe">Europe</option>
          </motion.select>

          <motion.select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="block w-full p-2 bg-transparent text-gray-200"
          >
            <option value="">All Genres</option>
            <option value="pop">Pop</option>
            <option value="rock">Rock</option>
            <option value="hip hop">Hip Hop</option>
            <option value="dance">Dance</option>
            <option value="house">House</option>
          </motion.select>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3, duration: 1 }}
        >
          <StationList
            stations={stations}
            currentStation={currentStation}
            selectStation={selectStation}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
