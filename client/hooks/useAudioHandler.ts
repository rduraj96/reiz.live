import { useRef, useEffect } from "react";

export function useAudioSetup(
  stationURL: string | null,
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>,
  setAudioData: React.Dispatch<React.SetStateAction<Uint8Array | null>>
) {
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!stationURL) return;

    if (audioElementRef.current && !audioElementRef.current.paused) {
      audioElementRef.current.pause();
      setPlaying(false);
    }
    audioElementRef.current = new Audio(stationURL);
    audioElementRef.current.preload = "auto";
    audioElementRef.current.crossOrigin = "anonymous";

    const audioContext = new AudioContext();
    analyserRef.current = audioContext.createAnalyser();
    analyserRef.current.fftSize = 512;

    const audioSource = audioContext.createMediaElementSource(
      audioElementRef.current
    );
    audioSource.connect(analyserRef.current);
    analyserRef.current.connect(audioContext.destination);

    audioElementRef.current.play().catch((error) => {
      console.error("Failed to play audio:", error);
    });
    setPlaying(true);
    console.log("Audio setup completed");
  }, [stationURL, setPlaying]);

  return { audioElementRef, analyserRef };
}
