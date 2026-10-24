"use client";

import { useEffect, useState } from "react";
import { usePlayer } from "@/store/player";
import styles from "./BigName.module.css";

const STAGGER_MS = 32;
const LONG_NAME = 14;

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

/** The huge outlined station name behind the blob; letters rise in with a stagger, and blur away while tuning. */
export function BigName() {
  const name = usePlayer((s) => s.current?.name ?? "");
  const tuning = usePlayer((s) => s.tuning);
  // The name whose letters have risen; lags `name` by two frames so each new name animates from its start state.
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (!name) return;
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setShown(name));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [name]);

  const reduced = reducedMotion();
  const cls = [styles.bigname, name.length > LONG_NAME ? styles.long : "", tuning ? styles.out : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div aria-hidden="true" className={cls}>
      {[...name].map((ch, i) => (
        <span
          key={`${name}-${i}`}
          className={`${styles.letter} ${shown === name ? styles.in : ""}`}
          style={{ transitionDelay: `${reduced ? 0 : i * STAGGER_MS}ms` }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </div>
  );
}
