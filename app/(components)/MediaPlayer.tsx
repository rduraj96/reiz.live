import React from "react";
import AudioPlayer from "react-audio-player";

type MediaPlayerProps = {
  stationUrl: string | null;
  playStation: () => void;
  pauseStation: () => void;
};

const MediaPlayer: React.FC<MediaPlayerProps> = ({
  stationUrl,
  playStation,
  pauseStation,
}) => {
  return (
    <div className="flex flex-col items-center mb-4">
      {stationUrl && (
        <AudioPlayer
          src={stationUrl}
          autoPlay={true}
          controls
          onPlay={playStation}
          onPause={pauseStation}
        />
      )}
    </div>
  );
};

export default MediaPlayer;
