import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { gameWorldService } from '../services/gameWorldService';
import { useAuth } from './AuthContext';

export interface GameWorldOption {
  label: string;
  value: string;
}

export interface GameWorldContextType {
  worlds: GameWorldOption[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const GameWorldContext = createContext<GameWorldContextType | undefined>(undefined);

interface GameWorldProviderProps {
  children: ReactNode;
}

export const GameWorldProvider: React.FC<GameWorldProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [worlds, setWorlds] = useState<GameWorldOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGameWorlds = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await gameWorldService.getGameWorlds({ limit: 1000 });
      const worldOptions: GameWorldOption[] = (result.worlds || []).map((world: any) => ({
        label: world.name,
        value: world.worldId,
      }));
      setWorlds(worldOptions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load game worlds';
      setError(errorMessage);
      console.error('Error loading game worlds:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch only when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadGameWorlds();
    } else {
      // Reset and stop loading when unauthenticated
      setWorlds([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Listen for game world updates from backend (only when authenticated)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gameWorldsUpdated' && isAuthenticated) {
        loadGameWorlds();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isAuthenticated]);

  const value: GameWorldContextType = {
    worlds,
    isLoading,
    error,
    refresh: loadGameWorlds,
  };

  return (
    <GameWorldContext.Provider value={value}>
      {children}
    </GameWorldContext.Provider>
  );
};

export const useGameWorld = (): GameWorldContextType => {
  const context = useContext(GameWorldContext);
  if (!context) {
    throw new Error('useGameWorld must be used within GameWorldProvider');
  }
  return context;
};

