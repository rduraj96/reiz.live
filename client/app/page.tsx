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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AudioVizualizerBlob from "./(components)/AudioVizualizerBlob";
import { motion } from "framer-motion";
import { RandomReveal } from "react-random-reveal"; // import Typed from "react-typed";
import { RadioStation } from "./types";
import { SelectGroup } from "@radix-ui/react-select";
import ReactCountryFlag from "react-country-flag";
import { genres } from "@/lib/genres";

export default function Home() {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [currentStation, setCurrentStation] = useState<RadioStation>(
    stations[0]
  );
  const [selectedGenre, setSelectedGenre] = useState<string>();
  const [selectedLanguage, setSelectedLanguage] = useState<string>("english");
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const response = await fetch(
          `/api/stations?language=${selectedLanguage}&tag=${selectedGenre}`
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
  }, [selectedGenre, selectedLanguage]);

  const selectStation = (station: RadioStation) => {
    setCurrentStation(station);
  };

  return (
    <div className="relative h-screen bg-foreground">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, type: "keyframes" }}
      >
        <AudioVizualizerBlob stationURL={currentStation?.url || null} />
        {/* <AsciiEffectScene /> */}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, type: "tween" }}
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
        className="flex flex-col space-y-3 w-fit absolute md:top-1/2 md:left-[10%] xl:left-[20%] md:transform md:-translate-y-1/2 top-10 left-5"
      >
        <div className="text-gray-200 text-lg">{`[ BROWSE ]`}</div>

        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
          <SelectTrigger className="text-gray-400 text-md border-none focus:ring-0 w-32 hover:text-white">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent className="overflow-scroll">
            <SelectGroup>
              <SelectLabel>Language</SelectLabel>
              {/* <SelectItem value="music">Any</SelectItem> */}
              <SelectItem value="german">Deutsch</SelectItem>
              <SelectItem value="english">English</SelectItem>
              <SelectItem value="spanish">Español</SelectItem>
              <SelectItem value="french">Français</SelectItem>
              <SelectItem value="italian">Italiano</SelectItem>
              <SelectItem value="portugese">Português</SelectItem>
              <SelectItem value="russian">Pусский</SelectItem>
              <SelectItem value="albanian">Shqip</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              role="combobox"
              aria-expanded={open}
              className="w-32 justify-between focus:ring-0 text-gray-400 text-md px-3 hover:bg-transparent hover:text-white"
            >
              {selectedGenre
                ? genres.find((genre) => genre.value === selectedGenre)?.label
                : "Genre..."}
              <ChevronsUpDown className="ml-2 h-4 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-0">
            <Command>
              <CommandInput placeholder="Search..." />
              <CommandEmpty>Genre not found.</CommandEmpty>
              <CommandList>
                {genres.map((genre) => (
                  <CommandItem
                    key={genre.value}
                    onSelect={(currentValue) => {
                      setSelectedGenre(
                        currentValue === value ? "" : currentValue
                      );
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedGenre === genre.value
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {genre.label}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {stations.length !== 0 && (
          <Select
            value={currentStation?.url}
            onValueChange={(e) =>
              selectStation(stations.find((station) => station.url === e)!)
            }
          >
            <SelectTrigger className="mb-4 my-3 text-gray-400 text-md w-32 line-clamp-1 whitespace-nowrap border-none focus:ring-0 hover:text-white">
              <SelectValue>Stations</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Available Stations</SelectLabel>
                {stations &&
                  stations.map((station, i) => (
                    <SelectItem key={i} value={station.url}>
                      <div key={i} className="flex gap-2">
                        <span>
                          <ReactCountryFlag
                            countryCode={station.countryCode}
                            svg
                            aria-label={station.country}
                            title={station.countryCode}
                          />
                        </span>
                        {station.name}
                      </div>
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
          className="absolute md:top-1/2 md:right-[10%] xl:right-[20%] md:transform md:-translate-y-1/2 top-10 right-5"
        >
          <div className="flex flex-col gap-3 text-gray-400 text-md overflow-x-hidden">
            <div className="text-gray-200">{`[ NOW PLAYING ]`}</div>
            <div className="relative flex items-center justify-between w-36">
              <div className="whitespace-nowrap animate-marquee">
                {currentStation.name}
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <span>
                <ReactCountryFlag
                  countryCode={currentStation.countryCode}
                  svg
                  aria-label={currentStation.country}
                  title={currentStation.countryCode}
                />
              </span>
              <span className="whitespace-nowrap line-clamp-1 w-32">
                {currentStation.country.length > 16
                  ? currentStation.countryCode
                  : currentStation.country}
              </span>
            </div>
            <div>{`${currentStation.bitrate} kbps / ${currentStation.codec}`}</div>
            <a href={currentStation.homepage} target="_blank">
              Go to website
            </a>
          </div>
        </motion.div>
      )}
    </div>
  );
}
