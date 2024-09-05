"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { RadioStation } from "../app/types";
import { createClient } from "@/utils/supabase/client";

interface StationContextType {
  stations: RadioStation[];
  savedStations: RadioStation[];
  currentStation: RadioStation | null;
  selectedGenre: string;
  selectedLanguage: string;
  searching: boolean;
  user: any;
  isLoginModalOpen: boolean;
  fetchStations: () => Promise<void>;
  handleSave: (station: RadioStation) => Promise<void>;
  handleRemove: (station: RadioStation) => Promise<void>;
  selectStation: (station: RadioStation) => void;
  setSelectedGenre: (genre: string) => void;
  setSelectedLanguage: (language: string) => void;
  setIsLoginModalOpen: (isOpen: boolean) => void;
  handleLoginSuccess: () => void;
  handleLogout: () => Promise<void>;
  isPlaying: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  recentStations: RadioStation[];
}

const StationContext = createContext<StationContextType | undefined>(undefined);

export const StationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [savedStations, setSavedStations] = useState<RadioStation[]>([]);
  const [currentStation, setCurrentStation] = useState<RadioStation | null>(
    null
  );
  const [selectedGenre, setSelectedGenre] = useState<string>("house");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("english");
  const [searching, setSearching] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isPlaying, setPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [recentStations, setRecentStations] = useState<RadioStation[]>([]);

  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        fetchSavedStations(user.id);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchSavedStations(session.user.id);
      } else {
        setSavedStations([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedGenre) {
      fetchStations();
    }
  }, [selectedGenre, selectedLanguage]);

  const fetchSavedStations = async (userId: string) => {
    const { data, error } = await supabase
      .from("saved_stations")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching saved stations:", error);
    } else {
      setSavedStations(data);
    }
  };

  const fetchStations = async () => {
    setSearching(true);
    try {
      const response = await fetch(
        `/api/stations?language=${selectedLanguage}&tag=${selectedGenre}`
      );
      if (!response.ok) throw new Error("Failed to fetch stations");
      const data = await response.json();
      setStations(data);
    } catch (error) {
      console.error("Error fetching stations:", error);
    } finally {
      setSearching(false);
    }
  };

  const selectStation = useCallback((station: RadioStation) => {
    setCurrentStation(station);
    setRecentStations((prev) => {
      const newRecent = [
        station,
        ...prev.filter((s) => s.url !== station.url),
      ].slice(0, 10);
      return newRecent;
    });
  }, []);

  const handleSave = useCallback(
    async (station: RadioStation) => {
      if (!user) {
        setIsLoginModalOpen(true);
        return;
      }
      try {
        const { data, error } = await supabase.from("saved_stations").insert({
          user_id: user.id,
          name: station.name,
          url: station.url,
          urlResolved: station.urlResolved,
          favicon: station.favicon,
          country: station.country,
          countryCode: station.countryCode,
          language: station.language,
          tags: station.tags,
          bitrate: station.bitrate,
          codec: station.codec,
          homepage: station.homepage,
        });

        if (error) {
          console.error("Error saving station:", error);
        } else {
          console.log("Station saved successfully:", station.name);
          setSavedStations((prev) => [...prev, station]);
        }
      } catch (e) {
        console.error("Exception when saving station:", e);
      }
    },
    [user, supabase]
  );

  const handleRemove = useCallback(
    async (station: RadioStation) => {
      if (!user) {
        setIsLoginModalOpen(true);
        return;
      }
      const { error } = await supabase
        .from("saved_stations")
        .delete()
        .eq("user_id", user.id)
        .eq("url", station.url);

      if (error) {
        console.error("Error removing station:", error);
      } else {
        console.log("Station removed:", station.name);
        setSavedStations((prev) => prev.filter((s) => s.url !== station.url));
      }
    },
    [user, supabase]
  );

  const handleLoginSuccess = () => {
    if (user) {
      fetchSavedStations(user.id);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error);
    } else {
      setUser(null);
      setSavedStations([]);
    }
  };

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  return (
    <StationContext.Provider
      value={{
        stations,
        savedStations,
        currentStation,
        selectedGenre,
        selectedLanguage,
        searching,
        user,
        isLoginModalOpen,
        fetchStations,
        handleSave,
        handleRemove,
        selectStation,
        setSelectedGenre,
        setSelectedLanguage,
        setIsLoginModalOpen,
        handleLoginSuccess,
        handleLogout,
        isPlaying,
        isMuted,
        toggleMute,
        setPlaying,
        recentStations,
      }}
    >
      {children}
    </StationContext.Provider>
  );
};

export const useStationContext = () => {
  const context = useContext(StationContext);
  if (context === undefined) {
    throw new Error("useStationContext must be used within a StationProvider");
  }
  return context;
};
