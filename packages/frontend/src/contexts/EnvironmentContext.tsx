import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { environmentService, Environment } from '../services/environmentService';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import { useOrgProject } from './OrgProjectContext';

const STORAGE_KEY = 'gatrix_selected_environment_id';
const STORAGE_KEY_NAME = 'gatrix_selected_environment_name';

interface UserEnvironmentAccess {
  allowAllEnvironments: boolean;
  environments: string[]; // List of environment names user has access to
}

export interface EnvironmentContextType {
  environments: Environment[];
  allEnvironments: Environment[]; // All environments (for admin UI)
  currentEnvironment: Environment | null;
  currentEnvironmentId: string | null; // Keep for backward compatibility (actually environment name)
  isLoading: boolean;
  error: string | null;
  switchEnvironment: (orgId: string, projectId: string, environmentId: string) => void;
  refresh: () => Promise<void>;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

interface EnvironmentProviderProps {
  children: ReactNode;
}

// Get stored environment from localStorage
const getStoredEnvironment = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY);
  }
  return null;
};

// Store environment to localStorage
const storeEnvironment = (environmentId: string, name: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, environmentId);
    localStorage.setItem(STORAGE_KEY_NAME, name);
  }
};

export const EnvironmentProvider: React.FC<EnvironmentProviderProps> = ({ children }) => {
  const { isAuthenticated, hasPermission, permissions, permissionsLoading } = useAuth();
  const hasAnyPermissions = !permissionsLoading && permissions.length > 0;
  const { getProjectApiPath, currentProjectId, switchContext } = useOrgProject();
  const [allEnvironments, setAllEnvironments] = useState<Environment[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [currentEnvironmentId, setCurrentEnvironmentId] = useState<string | null>(
    getStoredEnvironment()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Find current environment from the list
  const currentEnvironment =
    environments.find((env) => env.environmentId === currentEnvironmentId) || null;

  // Load environments from API
  const loadEnvironments = useCallback(async () => {
    const projectApiPath = getProjectApiPath();
    if (!projectApiPath) {
      // No org/project selected yet — skip loading
      setEnvironments([]);
      setAllEnvironments([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      // Load all environments for the current project
      const envList = await environmentService.getEnvironments(projectApiPath);
      // Store all environments for admin UI
      setAllEnvironments(envList);

      // Try to load user's access permissions
      let accessibleEnvs: Environment[];
      try {
        const accessResponse = await apiService.get<UserEnvironmentAccess>(
          '/admin/users/me/environments'
        );
        // Filter environments based on user access
        const userAccess = accessResponse.data;

        if (userAccess.allowAllEnvironments) {
          accessibleEnvs = envList;
        } else {
          // Use environments array (names) instead of environmentIds
          const accessList = userAccess.environments || (userAccess as any).environments || [];
          accessibleEnvs = envList.filter((env) => accessList.includes(env.environmentId));
        }
      } catch (accessError) {
        console.warn(
          '[EnvironmentContext] Failed to load user access, allowing all environments:',
          accessError
        );
        // If we can't load access permissions, allow all environments
        accessibleEnvs = envList;
      }
      setEnvironments(accessibleEnvs);

      // Get the currently stored environment
      const storedEnv = getStoredEnvironment();

      // If no environment is selected, select the first one (or default)
      if (!storedEnv && accessibleEnvs.length > 0) {
        // Prefer the first environment or the one marked as default
        const defaultEnv = accessibleEnvs.find((e) => e.isDefault) || accessibleEnvs[0];
        if (defaultEnv) {
          setCurrentEnvironmentId(defaultEnv.environmentId);
          storeEnvironment(defaultEnv.environmentId, defaultEnv.displayName);
        }
      } else if (storedEnv && !accessibleEnvs.find((e) => e.environmentId === storedEnv)) {
        // If the stored environment doesn't exist anymore or not accessible, reset to first
        if (accessibleEnvs.length > 0) {
          setCurrentEnvironmentId(accessibleEnvs[0].environmentId);
          storeEnvironment(accessibleEnvs[0].environmentId, accessibleEnvs[0].displayName);
        } else {
          // No accessible environments - clear localStorage as well
          setCurrentEnvironmentId(null);
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_KEY_NAME);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load environments';
      setError(errorMessage);
      console.error('Error loading environments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getProjectApiPath]);

  // Reload environments when project changes
  useEffect(() => {
    if (isAuthenticated && hasAnyPermissions && currentProjectId) {
      loadEnvironments();
    } else if (!isAuthenticated) {
      // Reset when unauthenticated
      setEnvironments([]);
      setAllEnvironments([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, currentProjectId, loadEnvironments]);

  const switchEnvironment = useCallback(
    (orgId: string, projectId: string, environmentId: string) => {
      // Atomically switch org and project context
      switchContext(orgId, projectId);

      // Set environment ID and persist
      const env =
        environments.find((e) => e.environmentId === environmentId) ||
        allEnvironments.find((e) => e.environmentId === environmentId);
      if (env) {
        setCurrentEnvironmentId(environmentId);
        storeEnvironment(environmentId, env.displayName);
      } else {
        // Environment not in current list — store ID directly; list will reload after project switch
        setCurrentEnvironmentId(environmentId);
        localStorage.setItem(STORAGE_KEY, environmentId);
      }

      // Dispatch custom event to notify other components
      window.dispatchEvent(
        new CustomEvent('environment-changed', {
          detail: { environmentId, orgId, projectId },
        })
      );
    },
    [environments, allEnvironments, switchContext]
  );

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

  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>;
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
