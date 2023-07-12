import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";

type Playlist = {
  title: string;
  url: string;
};

const YouTubeAudioPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playlist, setPlaylist] = useState<Playlist[]>([]);
  const [isPlaying, setPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [seekerValue, setSeekerValue] = useState(0);

  useEffect(() => {
    const getPlaylist = async () => {
      try {
        const response = await fetch("/api/youtube-audio");
        const data = await response.json();

        if (response.ok) {
          setPlaylist(data);
        } else {
          console.error("Error retrieving audio streams:", data.error);
        }
      } catch (error) {
        console.error("Error retrieving audio streams:", error);
      }
    };

    getPlaylist();
  }, []);

  useEffect(() => {
    const audioElement = audioRef.current;

    if (audioElement) {
      audioElement.src = playlist[currentTrackIndex].url;
      audioElement.play();

      const handleLoadedData = () => {
        setDuration(audioElement.duration);
      };

      const handleTimeUpdate = () => {
        setCurrentTime(audioElement.currentTime);
      };

      audioElement.addEventListener("loadeddata", handleLoadedData);
      audioElement.addEventListener("timeupdate", handleTimeUpdate);
      return () => {
        audioElement.removeEventListener("loadeddata", handleLoadedData);
        audioElement.removeEventListener("timeupdate", handleTimeUpdate);
      };
    }
  }, [playlist, currentTrackIndex]);

  const playTrack = () => {
    audioRef.current?.play();
  };

  const pauseTrack = () => {
    audioRef.current?.pause();
  };

  const playNextTrack = () => {
    if (currentTrackIndex < playlist.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1);
      setSeekerValue(0);
    }
  };

  const playPreviousTrack = () => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(currentTrackIndex - 1);
      setSeekerValue(0);
    }
  };

  const handleEnded = () => {
    setCurrentTrackIndex((prevIndex) => (prevIndex + 1) % playlist.length);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleSeekerChange = (seek: number[]) => {
    const newSeekerValue = seek[0];
    setCurrentTime(newSeekerValue);

    // Calculate the new time based on the seeker value
    // const newTime = (newSeekerValue / 100) * duration;
    audioRef.current!.currentTime = newSeekerValue;
  };

  return (
    playlist.length !== 0 && (
      <div className="relative space-y-4 mb-5">
        <div className="text-center">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        <div className="relative w-full cursor-pointer">
          <Slider
            min={0}
            max={duration}
            value={[currentTime]}
            onValueChange={handleSeekerChange}
          />
        </div>
        <div className="text-xl pb-4">
          <div className="truncate w-full sm:w-80">
            {playlist[currentTrackIndex].title}
          </div>
        </div>
        <div className="flex justify-between items-center gap-10">
          <h3
            className="text-white font-bold text-lg cursor-pointer"
            onClick={playPreviousTrack}
          >
            PREV
            {currentTrackIndex !== 0 && (
              <span className="block text-md text-gray-400">
                Track {currentTrackIndex}
              </span>
            )}
          </h3>
          <button
            className="hover:cursor-pointer text-white"
            onClick={() => setPlaying((prev) => !prev)}
          >
            {isPlaying ? (
              <Pause size={56} onClick={pauseTrack} />
            ) : (
              <Play size={56} onClick={playTrack} />
            )}
          </button>
          <h3
            className="text-white font-bold text-lg cursor-pointer"
            onClick={playNextTrack}
          >
            NEXT
            {currentTrackIndex !== playlist.length - 1 && (
              <span className="block text-md text-gray-400">
                Track {currentTrackIndex + 2}
              </span>
            )}
          </h3>
        </div>
        <audio
          autoPlay={false}
          ref={audioRef}
          src={playlist[currentTrackIndex].url}
          onEnded={handleEnded}
          onPlaying={() => setPlaying(true)}
        />
      </div>
    )
  );
};

export default YouTubeAudioPlayer;
