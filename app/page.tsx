"use client";

import { motion } from "motion/react";
import { Header } from "@/components/Header";
import { PlayBar } from "@/components/PlayBar";
import ScrollSelect from "@/components/ScrollSelect";
import { StationStatus } from "@/components/StationStatus";
import { Visualizer } from "@/components/Visualizer";
import { useEngineBridge } from "@/hooks/useEngineBridge";
import { useStations } from "@/hooks/useStations";
import { genres, languages } from "@/lib/catalog";
import { usePlayer } from "@/store/player";

const languageOptions = [{ value: "any", label: "Any" }, ...languages];

export default function Home() {
  useEngineBridge();
  const { loading, retry } = useStations();

  const genre = usePlayer((s) => s.genre);
  const language = usePlayer((s) => s.language);
  const setGenre = usePlayer((s) => s.setGenre);
  const setLanguage = usePlayer((s) => s.setLanguage);
  const listEmpty = usePlayer((s) => s.list.length === 0);
  const listError = usePlayer((s) => s.listError);
  const playbackFailed = usePlayer((s) => s.status === "error");

  return (
    <main className="relative w-full min-h-dvh overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="absolute inset-0"
      >
        <Visualizer />
      </motion.div>

      <Header onOpen={() => {}} onAbout={() => {}} />

      <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="pointer-events-auto ml-4 md:ml-[5%] lg:ml-[10%]"
        >
          <ScrollSelect
            options={languageOptions}
            value={language}
            onChange={setLanguage}
            label="Language"
            orientation="left"
            width="w-36 md:w-64"
          />
        </motion.div>

        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="pointer-events-auto mr-4 md:mr-[5%] lg:mr-[10%]"
        >
          <ScrollSelect
            options={genres}
            value={genre}
            onChange={setGenre}
            label="Genre"
            orientation="right"
            width="w-36 md:w-64"
          />
        </motion.div>
      </div>

      <div className="absolute bottom-20 left-0 right-0 z-20 flex justify-center px-4 text-lg">
        <StationStatus
          loading={loading}
          listError={listError}
          empty={listEmpty}
          playbackFailed={playbackFailed}
          language={language}
          onRetry={retry}
          onAnyLanguage={() => setLanguage("any")}
        />
      </div>

      <PlayBar />
    </main>
  );
}
