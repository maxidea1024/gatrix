import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { varsService } from "../services/varsService";
import {
  PlatformOption,
  ChannelOption,
  PlatformConfigContextType,
} from "../types/platformConfig";
import { useAuth } from "./AuthContext";

const PlatformConfigContext = createContext<
  PlatformConfigContextType | undefined
>(undefined);

interface PlatformConfigProviderProps {
  children: ReactNode;
}

export const PlatformConfigProvider: React.FC<PlatformConfigProviderProps> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  const [platforms, setPlatforms] = useState<PlatformOption[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlatformConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const config = await varsService.getPlatformConfig();
      setPlatforms(config.platforms);
      setChannels(config.channels);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to load platform configuration";
      setError(errorMessage);
      console.error("Error loading platform config:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch only when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadPlatformConfig();
    } else {
      // Reset and stop loading when unauthenticated
      setPlatforms([]);
      setChannels([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Listen for platform/channel updates from backend (only when authenticated)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "platformConfigUpdated" && isAuthenticated) {
        loadPlatformConfig();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [isAuthenticated]);

  const value: PlatformConfigContextType = {
    platforms,
    channels,
    isLoading,
    error,
    refresh: loadPlatformConfig,
  };

  return (
    <PlatformConfigContext.Provider value={value}>
      {children}
    </PlatformConfigContext.Provider>
  );
};

export const usePlatformConfig = (): PlatformConfigContextType => {
  const context = useContext(PlatformConfigContext);
  if (!context) {
    throw new Error(
      "usePlatformConfig must be used within PlatformConfigProvider",
    );
  }
  return context;
};
