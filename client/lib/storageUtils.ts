import { RadioStation } from "../app/types";

const STORAGE_KEY = "radioStations";

export const saveToLocalStorage = (newStations: RadioStation[]) => {
  const storedData = loadFromLocalStorage();
  const updatedData = [...storedData, ...newStations];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
};

export const removeFromLocalStorage = (stationUrl: string) => {
  const storedData = loadFromLocalStorage();
  const updatedData = storedData.filter(
    (station) => station.url !== stationUrl
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
};

export const loadFromLocalStorage = (): RadioStation[] => {
  const storedData = localStorage.getItem(STORAGE_KEY);
  if (storedData) {
    return JSON.parse(storedData);
  }
  return [];
};
