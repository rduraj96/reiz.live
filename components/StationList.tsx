"use client";

import { motion } from "motion/react";
import { togglePlay } from "@/hooks/useEngineBridge";
import { usePlayer } from "@/store/player";
import { StationRow } from "./StationRow";

/** Simple overlay listing the current stations. Task 10 moves this into a tabbed panel. */
export function StationList({ onClose }: { onClose: () => void }) {
  const list = usePlayer((s) => s.list);
  const current = usePlayer((s) => s.current);
  const select = usePlayer((s) => s.select);
  const status = usePlayer((s) => s.status);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Stations"
        className="bg-black/80 rounded-lg p-6 w-full max-w-3xl max-h-[80dvh] overflow-hidden flex flex-col shadow-2xl border border-muted"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-3xl font-bold tracking-tight">STATIONS</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="size-11 text-2xl text-muted hover:text-foreground"
          >
            ×
          </button>
        </div>
        {list.length === 0 ? (
          <p className="text-muted">No stations loaded.</p>
        ) : (
          <ul className="overflow-y-auto space-y-2">
            {list.map((station) => (
              <StationRow
                key={station.id}
                station={station}
                active={station.id === current?.id}
                onSelect={() => {
                  if (station.id !== current?.id) select(station);
                  else if (status === "paused" || status === "blocked" || status === "idle") togglePlay();
                  onClose();
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
