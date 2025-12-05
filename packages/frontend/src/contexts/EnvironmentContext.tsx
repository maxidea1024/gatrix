import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { environmentService, Environment } from '../services/environmentService';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'gatrix_selected_environment_id';

interface UserEnvironmentAccess {
  allowAllEnvironments: boolean;
  environmentIds: string[];
}

export interface EnvironmentContextType {
  environments: Environment[];
  allEnvironments: Environment[]; // All environments (for admin UI)
  currentEnvironment: Environment | null;
  currentEnvironmentId: string | null;
  isLoading: boolean;
  error: string | null;
  switchEnvironment: (environmentId: string) => void;
  refresh: () => Promise<void>;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

interface EnvironmentProviderProps {
  children: ReactNode;
}

// Get stored environment ID from localStorage
const getStoredEnvironmentId = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY);
  }
  return null;
};

// Store environment ID to localStorage
const storeEnvironmentId = (id: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, id);
  }
};

export const EnvironmentProvider: React.FC<EnvironmentProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [allEnvironments, setAllEnvironments] = useState<Environment[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [currentEnvironmentId, setCurrentEnvironmentId] = useState<string | null>(getStoredEnvironmentId());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Find current environment from the list
  const currentEnvironment = environments.find(env => env.id === currentEnvironmentId) || null;

  // Load environments from API
  const loadEnvironments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[EnvironmentContext] Calling environmentService.getEnvironments()...');

      // Load all environments first
      const envList = await environmentService.getEnvironments();
      console.log('[EnvironmentContext] Got environments:', envList);

      // Store all environments for admin UI
      setAllEnvironments(envList);

      // Try to load user's access permissions
      let accessibleEnvs: Environment[];
      try {
        const accessResponse = await apiService.get<UserEnvironmentAccess>('/admin/users/me/environments');
        console.log('[EnvironmentContext] Got user access:', accessResponse.data);

        // Filter environments based on user access
        const userAccess = accessResponse.data;

        if (userAccess.allowAllEnvironments) {
          accessibleEnvs = envList;
        } else {
          accessibleEnvs = envList.filter(env => userAccess.environmentIds.includes(env.id));
        }
      } catch (accessError) {
        console.warn('[EnvironmentContext] Failed to load user access, allowing all environments:', accessError);
        // If we can't load access permissions, allow all environments
        accessibleEnvs = envList;
      }

      console.log('[EnvironmentContext] Accessible environments:', accessibleEnvs);
      setEnvironments(accessibleEnvs);

      // If no environment is selected, select the first one (or default)
      if (!currentEnvironmentId && accessibleEnvs.length > 0) {
        // Prefer the first environment or the one marked as default
        const defaultEnv = accessibleEnvs.find(e => e.environmentName === 'Default') || accessibleEnvs[0];
        if (defaultEnv) {
          setCurrentEnvironmentId(defaultEnv.id);
          storeEnvironmentId(defaultEnv.id);
        }
      } else if (currentEnvironmentId && !accessibleEnvs.find(e => e.id === currentEnvironmentId)) {
        // If the stored environment ID doesn't exist anymore or not accessible, reset to first
        if (accessibleEnvs.length > 0) {
          setCurrentEnvironmentId(accessibleEnvs[0].id);
          storeEnvironmentId(accessibleEnvs[0].id);
        } else {
          // No accessible environments
          setCurrentEnvironmentId(null);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load environments';
      setError(errorMessage);
      console.error('Error loading environments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentEnvironmentId]);

  // Fetch environments only when authenticated
  useEffect(() => {
    console.log('[EnvironmentContext] isAuthenticated changed:', isAuthenticated);
    if (isAuthenticated) {
      console.log('[EnvironmentContext] Loading environments...');
      loadEnvironments();
    } else {
      // Reset when unauthenticated
      setEnvironments([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, loadEnvironments]);

  // Switch to a different environment
  const switchEnvironment = useCallback((environmentId: string) => {
    const env = environments.find(e => e.id === environmentId);
    if (env) {
      setCurrentEnvironmentId(environmentId);
      storeEnvironmentId(environmentId);
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('environment-changed', {
        detail: { environmentId, environment: env }
      }));
    }
  }, [environments]);

  const value: EnvironmentContextType = {
    environments,
    allEnvironments,
    currentEnvironment,
    currentEnvironmentId,
    isLoading,
    error,
    switchEnvironment,
    refresh: loadEnvironments,
  };

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
};

export const useEnvironment = (): EnvironmentContextType => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return context;
};

// Alias for useEnvironment - returns all environments for admin UI
export const useEnvironments = () => {
  const context = useEnvironment();
  return {
    environments: context.allEnvironments,
    isLoading: context.isLoading,
    error: context.error,
    refresh: context.refresh,
  };
};

export default EnvironmentContext;

