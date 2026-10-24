"use client";

import { motion } from "motion/react";

type HeaderProps = {
  onOpen: (tab: "recent" | "saved") => void;
  onAbout: () => void;
};

const navItem =
  "min-h-11 min-w-11 px-1 flex items-center justify-center cursor-pointer";

export function Header({ onOpen, onAbout }: HeaderProps) {
  return (
    <motion.header
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="z-30 absolute top-0 left-0 right-0 mt-4 px-4 md:mt-7 md:px-7 flex flex-col md:flex-row items-center justify-between w-full"
    >
      <h1 className="text-4xl md:text-6xl text-foreground tracking-tight font-bold mb-2 md:mb-0">
        REIZDIO
      </h1>
      <nav className="flex flex-wrap justify-center items-center gap-2 font-medium text-lg md:text-2xl text-foreground">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={navItem}
          onClick={() => onOpen("recent")}
        >
          RECENT
        </motion.button>
        <div className="w-4 h-0.5 bg-gray-200 hidden md:block" />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={navItem}
          onClick={() => onOpen("saved")}
        >
          SAVED
        </motion.button>
        <div className="w-4 h-0.5 bg-white hidden md:block" />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={navItem}
          onClick={onAbout}
        >
          ABOUT
        </motion.button>
      </nav>
    </motion.header>
  );
}
