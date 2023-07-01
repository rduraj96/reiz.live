import React from "react";

type StationListProps = {
  stations: { name: string; url: string }[];
  currentStation: string | null;
  selectStation: (stationName: string) => void;
};

const StationList: React.FC<StationListProps> = ({
  stations,
  currentStation,
  selectStation,
}) => {
  return (
    <select
      value={currentStation || ""}
      onChange={(e) => selectStation(e.target.value)}
      className="p-2 mb-4 rounded-md border border-gray-300"
    >
      <option value="">Select a station</option>
      {stations.map((station) => (
        <option key={station.url} value={station.url}>
          {station.name}
        </option>
      ))}
    </select>
  );
};

export default StationList;
