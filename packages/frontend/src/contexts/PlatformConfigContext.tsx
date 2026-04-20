import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { varsService } from '../services/varsService';
import {
  PlatformOption,
  ChannelOption,
  PlatformConfigContextType,
} from '../types/platformConfig';
import { useAuth } from './AuthContext';
import { useOrgProject } from './OrgProjectContext';

const PlatformConfigContext = createContext<
  PlatformConfigContextType | undefined
>(undefined);

interface PlatformConfigProviderProps {
  children: ReactNode;
}

export const PlatformConfigProvider: React.FC<PlatformConfigProviderProps> = ({
  children,
}) => {
  const { isAuthenticated, permissions, permissionsLoading } = useAuth();
  const hasAnyPermissions = !permissionsLoading && permissions.length > 0;
  const { getProjectApiPath, currentProjectId } = useOrgProject();
  const [platforms, setPlatforms] = useState<PlatformOption[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlatformConfig = async () => {
    const projectApiPath = getProjectApiPath();
    if (!projectApiPath) {
      // No org/project selected yet — skip loading
      setPlatforms([]);
      setChannels([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const config = await varsService.getPlatformConfig(projectApiPath);
      setPlatforms(config.platforms);
      setChannels(config.channels);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to load platform configuration';
      setError(errorMessage);
      console.error('Error loading platform config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch when authenticated and project is selected
  // IMPORTANT: Wait for permissions to finish loading before deciding.
  // Without this guard, the effect fires while permissions are still loading,
  // falls into the else branch (clearing platforms), and never re-fires
  // because hasAnyPermissions was not in the dependency array.
  useEffect(() => {
    // Don't act while permissions are still loading — wait for stable state
    if (permissionsLoading) return;

    if (isAuthenticated && hasAnyPermissions && currentProjectId) {
      loadPlatformConfig();
    } else {
      // Reset and stop loading when unauthenticated or no project
      setPlatforms([]);
      setChannels([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, hasAnyPermissions, permissionsLoading, currentProjectId]);

  // Listen for platform/channel updates from backend (only when authenticated)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'platformConfigUpdated' && isAuthenticated) {
        loadPlatformConfig();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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
      'usePlatformConfig must be used within PlatformConfigProvider'
    );
  }
  return context;
};
