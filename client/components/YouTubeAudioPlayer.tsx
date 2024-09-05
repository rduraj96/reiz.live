import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { io, Socket } from "socket.io-client";

type Playlist = {
  title: string;
  url: string;
};

type AudioState = {
  currentTrackIndex: number;
  currentTime: number;
};

const YouTubeAudioPlayer: React.FC = () => {
  const socket = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playlist, setPlaylist] = useState<Playlist[]>([]);
  const [isPlaying, setPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [seekerValue, setSeekerValue] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);

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
      if (isPlaying) {
        audioElement.play();
      }

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

  useEffect(() => {
    socket.current = io(process.env.NEXT_PUBLIC_BACKEND_URL!);

    socket.current.on("connected-users", (users: string[]) => {
      setConnectedUsers(users);
      audioRef.current?.pause();
      setPlaying(false);
    });

    socket.current.emit("listener-ready");

    socket.current.on("get-audio-state", () => {
      console.log(currentTrackIndex, currentTime);
      socket.current?.emit("audio-state", {
        currentTrackIndex,
        currentTime,
      });
      console.log("Sent state", { currentTrackIndex });
    });

    socket.current.on("audio-state-from-server", (state: AudioState) => {
      setCurrentTrackIndex(state.currentTrackIndex);
      setCurrentTime(state.currentTime);
    });

    socket.current.on("play", () => {
      audioRef.current?.play();
      setPlaying(true);
    });

    socket.current.on("pause", () => {
      audioRef.current?.pause();
      setPlaying(false);
    });

    socket.current.on("track-change", (trackIndex) => {
      setCurrentTrackIndex(trackIndex);
    });

    socket.current.on("seek", (time: number) => {
      audioRef.current!.currentTime = time;
      setCurrentTime(time);
    });

    return () => {
      socket.current?.disconnect();
    };
  }, []);

  useEffect(() => {}, []);

  const playTrack = () => {
    audioRef.current?.play();
    socket.current?.emit("play");
  };

  const pauseTrack = () => {
    audioRef.current?.pause();
    socket.current?.emit("pause");
  };

  const playNextTrack = () => {
    if (currentTrackIndex < playlist.length - 1) {
      const nextTrackIndex = currentTrackIndex + 1;
      setCurrentTrackIndex(nextTrackIndex);
      socket.current?.emit("track-change", nextTrackIndex);
    }
  };

  const playPreviousTrack = () => {
    const nextTrackIndex = currentTrackIndex - 1;
    setCurrentTrackIndex(nextTrackIndex);
    socket.current?.emit("track-change", nextTrackIndex);
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
    audioRef.current!.currentTime = newSeekerValue;
    socket.current?.emit("seek", newSeekerValue);
  };

  return (
    playlist.length !== 0 && (
      <div className="relative space-y-4 mb-5">
        <div className="text-foreground mb-10 text-center space-x-3">
          <h4>Listener List:</h4>
          {connectedUsers.map((user, i) => (
            <div key={user} className="font-bold inline">
              Listener {i + 1}
            </div>
          ))}
        </div>
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
          <div className="truncate w-full">
            {playlist[currentTrackIndex].title}
          </div>
        </div>
        <div className="flex justify-between items-center gap-10">
          <h3
            className="text-foreground font-bold text-lg cursor-pointer"
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
            className="hover:cursor-pointer text-foreground"
            onClick={() => setPlaying((prev) => !prev)}
          >
            {isPlaying ? (
              <Pause size={56} onClick={pauseTrack} />
            ) : (
              <Play size={56} onClick={playTrack} />
            )}
          </button>
          <h3
            className="text-foreground font-bold text-lg cursor-pointer"
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
