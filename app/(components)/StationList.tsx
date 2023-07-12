import React from "react";
import { RadioStation } from "../types";

type StationListProps = {
  stations: RadioStation[];
  currentStation: RadioStation | null;
  selectStation: (station: RadioStation) => void;
};

const StationList: React.FC<StationListProps> = ({
  stations,
  currentStation,
  selectStation,
}) => {
  return (
    <select
      value={currentStation?.urlResolved || ""}
      onChange={(e) =>
        selectStation(
          stations.find((station) => station.urlResolved === e.target.value)!
        )
      }
      className="p-2 mb-4 my-3 bg-transparent text-gray-200"
    >
      <option value="">Select a station</option>
      {stations.map((station, i) => (
        <option key={station.urlResolved} value={station.urlResolved}>
          {`Station #${i + 1}`}
        </option>
      ))}
    </select>
  );
};

export default StationList;
