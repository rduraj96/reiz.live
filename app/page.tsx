"use client";

import React, { useEffect, useState, useRef } from "react";
import { RadioBrowserApi, Station } from "radio-browser-api";
import StationList from "./(components)/StationList";
import MediaPlayer from "./(components)/MediaPlayer";
import AsciiEffectScene from "./(components)/Scene";
import SpectogramVisualizer from "./(components)/SpectogramVisualizer";

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

  // useEffect(() => {
  //   const fetchStations = async () => {
  //     try {
  //       const response = await fetch(
  //         `/api/stations?limit=20&language=${selectedLanguage}&tag=${selectedGenre}`
  //       );

  //       if (!response.ok) {
  //         throw new Error("Failed to fetch stations");
  //       }

  //       const data = await response.json();
  //       setStations(data);
  //     } catch (error) {
  //       console.error("Error fetching stations:", error);
  //     }
  //   };

  //   fetchStations();

  //   return () => {
  //     if (audioPlayer) {
  //       audioPlayer.pause();
  //       audioPlayer.src = "";
  //     }
  //   };
  // }, [selectedRegion, selectedGenre]);

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
      {!audioPlayer?.paused ? <AsciiEffectScene /> : <SpectogramVisualizer />}
      {/* <SpectogramVisualizer /> */}
      <div className="absolute top-1/2 left-1/2">
        <h1 className="text-2xl text-white font-bold mb-6">Reiz.live</h1>
        <div className="flex gap-5">
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">All Regions</option>
            <option value="Africa">Africa</option>
            <option value="Asia">Asia</option>
            <option value="Europe">Europe</option>
            {/* Add more regions as needed */}
          </select>

          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="block w-full p-2 border rounded-md"
          >
            <option value="">All Genres</option>
            <option value="pop">Pop</option>
            <option value="rock">Rock</option>
            <option value="hip hop">Hip Hop</option>
            <option value="dance">Dance</option>
            <option value="house">House</option>
            {/* Add more genres as needed */}
          </select>
        </div>
        <StationList
          stations={stations}
          currentStation={currentStation}
          selectStation={selectStation}
        />
        <MediaPlayer
          stationUrl={currentStation}
          playStation={playStation}
          pauseStation={pauseStation}
        />
      </div>
    </div>
  );
}
