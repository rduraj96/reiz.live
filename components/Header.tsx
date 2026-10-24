"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { signOut, useAuth } from "@/store/auth";
import { SurpriseButton } from "./SurpriseButton";

type HeaderProps = {
  onOpen: (tab: "recent" | "saved") => void;
  onAbout: () => void;
};

const navItem =
  "min-h-11 min-w-11 px-1 flex items-center justify-center cursor-pointer";

const menuItem =
  "w-full min-h-11 px-4 flex items-center justify-start text-lg cursor-pointer hover:text-accent disabled:opacity-50";

/** Phone-only disclosure menu (below md). */
function MobileMenu({ onOpen, onAbout }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const user = useAuth((s) => s.user);
  const openLogin = useAuth((s) => s.openLogin);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={wrapRef} className="md:hidden relative" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        data-panel-opener="recent saved"
        onClick={() => setOpen((o) => !o)}
        className="size-11 flex items-center justify-center text-foreground cursor-pointer"
      >
        <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden="true">
          <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
        </svg>
      </button>
      {open && (
        <ul
          id="mobile-menu"
          className="absolute right-0 top-12 z-40 w-56 border border-muted bg-background py-1 text-foreground"
        >
          <li>
            <button type="button" className={menuItem} onClick={run(() => onOpen("recent"))}>
              Recent
            </button>
          </li>
          <li>
            <button type="button" className={menuItem} onClick={run(() => onOpen("saved"))}>
              Saved
            </button>
          </li>
          <li>
            <button type="button" className={menuItem} onClick={run(onAbout)}>
              About
            </button>
          </li>
          <li onClick={() => setOpen(false)}>
            <SurpriseButton label="Surprise me" className={menuItem} />
          </li>
          <li>
            <button
              type="button"
              className={menuItem}
              onClick={run(() => (user ? void signOut() : openLogin()))}
            >
              {user ? "Log out" : "Log in"}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

export function Header({ onOpen, onAbout }: HeaderProps) {
  const user = useAuth((s) => s.user);
  const openLogin = useAuth((s) => s.openLogin);
  return (
    <motion.header
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="z-30 absolute top-0 left-0 right-0 mt-4 px-4 md:mt-7 md:px-7 flex flex-row items-center justify-between w-full"
    >
      <h1 className="text-4xl md:text-6xl text-foreground tracking-tight font-bold">
        REIZDIO
      </h1>
      <MobileMenu onOpen={onOpen} onAbout={onAbout} />
      <nav className="hidden md:flex flex-wrap justify-center items-center gap-2 font-medium text-lg md:text-2xl text-foreground">
        <SurpriseButton className={`${navItem} disabled:opacity-50`} />
        <div className="w-4 h-0.5 bg-foreground hidden md:block" />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={navItem}
          data-panel-opener="recent"
          onClick={() => onOpen("recent")}
        >
          RECENT
        </motion.button>
        <div className="w-4 h-0.5 bg-foreground hidden md:block" />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={navItem}
          data-panel-opener="saved"
          onClick={() => onOpen("saved")}
        >
          SAVED
        </motion.button>
        <div className="w-4 h-0.5 bg-foreground hidden md:block" />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={navItem}
          onClick={onAbout}
        >
          ABOUT
        </motion.button>
        <div className="w-4 h-0.5 bg-foreground hidden md:block" />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={navItem}
          onClick={() => (user ? void signOut() : openLogin())}
        >
          {user ? "LOGOUT" : "LOGIN"}
        </motion.button>
      </nav>
    </motion.header>
  );
}
