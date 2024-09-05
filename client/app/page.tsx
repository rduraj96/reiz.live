"use client";

import LoginModal from "@/components/LoginModal";
import ScrollSelect from "@/components/ScrollSelect";
import { genres, languages } from "@/lib/data";
import { motion } from "framer-motion";
import VisualizerBlob from "../components/VisualizerBlob";
import { useStationContext } from "../contexts/StationContext";

export default function Home() {
  const {
    user,
    isLoginModalOpen,
    selectedGenre,
    selectedLanguage,
    setSelectedGenre,
    setSelectedLanguage,
    setIsLoginModalOpen,
    handleLoginSuccess,
    handleLogout,
  } = useStationContext();

  return (
    <div className="relative w-full min-h-screen bg-background overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, type: "keyframes" }}
          className="relative"
        >
          <VisualizerBlob />
        </motion.div>
      </div>

      {/* Header */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="z-50 absolute top-0 left-0 right-0 mt-4 px-4 md:mt-7 md:px-7 flex flex-col md:flex-row items-center justify-between w-full"
      >
        <h1 className="text-4xl md:text-6xl text-foreground tracking-tight font-bold font-neue mb-4 md:mb-0">
          {"REIZDIO"}
        </h1>
        <nav className="flex flex-wrap justify-center items-center gap-2 font-neue font-medium text-lg md:text-2xl text-foreground">
          <motion.p whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            RECENT
          </motion.p>
          <div className="w-4 h-0.5 bg-gray-200 hidden md:block"></div>
          <motion.p whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            SAVED
          </motion.p>
          <div className="w-4 h-0.5 bg-white hidden md:block"></div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            ABOUT
          </motion.div>
          <div className="w-4 h-0.5 bg-white hidden md:block"></div>
          {user ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
            >
              LOGOUT
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsLoginModalOpen(true)}
            >
              LOGIN
            </motion.button>
          )}
        </nav>
      </motion.div>

      <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
        {/* Language selection */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="pointer-events-auto ml-4 md:ml-[5%] lg:ml-[10%]"
        >
          <ScrollSelect
            options={languages}
            value={selectedLanguage}
            onChange={setSelectedLanguage}
            label="Language"
            orientation="left"
          />
        </motion.div>

        {/* Genre selection */}
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="pointer-events-auto mr-4 md:mr-[5%] lg:mr-[10%]"
        >
          <ScrollSelect
            options={genres}
            value={selectedGenre}
            onChange={setSelectedGenre}
            label="Genre"
            orientation="right"
          />
        </motion.div>
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
