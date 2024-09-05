import React, { createContext, useContext, RefObject } from "react";

interface AudioContextType {
  audioElementRef: RefObject<HTMLAudioElement>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{
  children: React.ReactNode;
  value: AudioContextType;
}> = ({ children, value }) => {
  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
};

export const useAudioContext = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error("useAudioContext must be used within an AudioProvider");
  }
  return context;
};
