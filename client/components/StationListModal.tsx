import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { FileAudio, Heart, Info, Radio, Wifi, X } from "lucide-react";
import React, { useState } from "react";
import ReactCountryFlag from "react-country-flag";
import { RadioStation } from "../app/types";
import { useStationContext } from "../contexts/StationContext";
import AnimatedWaveform from "./ui/AnimatedWaveform";

interface StationListModalProps {
  onClose: () => void;
}

const StationListModal: React.FC<StationListModalProps> = ({ onClose }) => {
  const {
    stations,
    savedStations,
    recentStations,
    currentStation,
    selectStation,
    isPlaying,
    handleSave,
    handleRemove,
  } = useStationContext();

  const [activeTab, setActiveTab] = useState<"search" | "saved" | "recent">(
    "search"
  );

  const renderStationList = (stationList: RadioStation[]) => (
    <ul className="space-y-3 font-neue">
      {stationList.map((station) => (
        <motion.li
          key={station.urlResolved}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className={`p-4 rounded-lg cursor-pointer border border-transparent transition-all flex items-center justify-between group text-foreground ${
            station.urlResolved === currentStation?.urlResolved
              ? "bg-foreground text-black border border-red"
              : "text-foreground hover:border hover:border-foreground"
          }`}
          onClick={() => {
            selectStation(station);
          }}
        >
          <div className="flex items-center space-x-4 flex-grow min-w-0">
            {station.urlResolved === currentStation?.urlResolved &&
            isPlaying ? (
              <AnimatedWaveform
                width={20}
                height={20}
                color="#000000"
                bars={6}
              />
            ) : (
              <Radio
                size={18}
                className="text-gray-400 group-hover:text-foreground transition-colors flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex-grow">
              <p className="font-medium text-lg truncate group-hover:whitespace-normal">
                <span className="group-hover:hidden">{station.name}</span>
                <span className="hidden group-hover:inline-block whitespace-nowrap">
                  {station.name}
                </span>
              </p>
              {/* <p className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors truncate">
                {station.tags.slice(0, 3).join(", ")}
              </p> */}
            </div>
          </div>
          <div className="flex items-center space-x-3 flex-shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`text-muted-foreground transition-colors ${
                      station.urlResolved === currentStation?.urlResolved
                        ? "hover:text-background"
                        : " hover:text-foreground"
                    }`}
                  >
                    <Info size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-primary text-primary-foreground">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <Wifi size={14} />
                      <span>{station.bitrate} kbps</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FileAudio size={14} />
                      <span>{station.codec}</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ReactCountryFlag
              countryCode={station.countryCode}
              svg
              aria-label={station.country}
              title={station.country}
              className="w-6 h-4"
            />
            {/* <span className="text-sm uppercase">{station.language}</span> */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                savedStations.some((s) => s.urlResolved === station.urlResolved)
                  ? handleRemove(station)
                  : handleSave(station);
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Heart
                size={18}
                fill={
                  savedStations.some(
                    (s) => s.urlResolved === station.urlResolved
                  )
                    ? "#ffffff"
                    : "none"
                }
              />
            </button>
          </div>
        </motion.li>
      ))}
    </ul>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 font-neue"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-black bg-opacity-70 rounded-lg p-8 w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl border border-muted-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6 font-neue">
            <h2 className="text-4xl font-bold text-foreground font-neue tracking-tight">
              STATIONS
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-foreground transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex space-x-4 mb-6">
            <button
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === "search"
                  ? "bg-foreground text-background"
                  : "border border-muted-foreground text-foreground hover:border-foreground"
              }`}
              onClick={() => setActiveTab("search")}
            >
              Search Results
            </button>
            <button
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === "saved"
                  ? "bg-foreground text-background"
                  : "border border-muted-foreground text-foreground hover:border-foreground"
              }`}
              onClick={() => setActiveTab("saved")}
            >
              Saved Stations
            </button>
            <button
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === "recent"
                  ? "bg-foreground text-background"
                  : "border border-muted-foreground text-foreground hover:border-foreground"
              }`}
              onClick={() => setActiveTab("recent")}
            >
              Recently Played
            </button>
          </div>
          <div className="overflow-y-auto flex-grow pr-4 -mr-4 custom-scrollbar">
            {activeTab === "search" && renderStationList(stations)}
            {activeTab === "saved" && renderStationList(savedStations)}
            {activeTab === "recent" && renderStationList(recentStations)}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StationListModal;
