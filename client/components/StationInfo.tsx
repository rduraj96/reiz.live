import React from "react";
import { RadioStation } from "../app/types";

type StationInfoProps = {
  currentStation: RadioStation | null;
  savedStations: RadioStation[];
  handleSave: () => void;
  handleRemove: () => void;
};

const StationInfo: React.FC<StationInfoProps> = ({
  currentStation,
  savedStations,
  handleSave,
  handleRemove,
}) => {
  if (!currentStation) {
    return null;
  }

  const isStationSaved = savedStations.some(
    (station) => station.urlResolved === currentStation.urlResolved
  );

  return (
    <div className="absolute bottom-0 right-0 p-4 w-64 bg-opacity-50 bg-black text-foreground">
      <h2 className="text-xl mb-4">Station Info</h2>
      <p className="mb-2">Name: {currentStation.name}</p>
      <p className="mb-2">Country: {currentStation.country}</p>
      <p className="mb-2">Language: {currentStation.language}</p>
      <p className="mb-2">Genre: {currentStation.tags.join(", ")}</p>
      {isStationSaved ? (
        <button
          onClick={handleRemove}
          className="bg-red-500 text-foreground px-4 py-2 rounded"
        >
          Remove from Favorites
        </button>
      ) : (
        <button
          onClick={handleSave}
          className="bg-green-500 text-foreground px-4 py-2 rounded"
        >
          Add to Favorites
        </button>
      )}
    </div>
  );
};

export default StationInfo;
