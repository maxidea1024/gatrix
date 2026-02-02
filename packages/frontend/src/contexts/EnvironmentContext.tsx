import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import {
  environmentService,
  Environment,
} from "../services/environmentService";
import { apiService } from "../services/api";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "gatrix_selected_environment";
const STORAGE_KEY_NAME = "gatrix_selected_environment_name";

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
  switchEnvironment: (environment: string) => void;
  refresh: () => Promise<void>;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(
  undefined,
);

interface EnvironmentProviderProps {
  children: ReactNode;
}

// Get stored environment from localStorage
const getStoredEnvironment = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem(STORAGE_KEY);
  }
  return null;
};

// Store environment to localStorage
const storeEnvironment = (environment: string, name: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, environment);
    localStorage.setItem(STORAGE_KEY_NAME, name);
  }
};

export const EnvironmentProvider: React.FC<EnvironmentProviderProps> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  const [allEnvironments, setAllEnvironments] = useState<Environment[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [currentEnvironmentId, setCurrentEnvironmentId] = useState<
    string | null
  >(getStoredEnvironment());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Find current environment from the list
  const currentEnvironment =
    environments.find((env) => env.environment === currentEnvironmentId) ||
    null;

  // Load environments from API
  const loadEnvironments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log(
        "[EnvironmentContext] Calling environmentService.getEnvironments()...",
      );

      // Load all environments first
      const envList = await environmentService.getEnvironments();
      console.log("[EnvironmentContext] Got environments:", envList);

      // Store all environments for admin UI
      setAllEnvironments(envList);

      // Try to load user's access permissions
      let accessibleEnvs: Environment[];
      try {
        const accessResponse = await apiService.get<UserEnvironmentAccess>(
          "/admin/users/me/environments",
        );
        console.log(
          "[EnvironmentContext] Got user access:",
          accessResponse.data,
        );

        // Filter environments based on user access
        const userAccess = accessResponse.data;

        if (userAccess.allowAllEnvironments) {
          accessibleEnvs = envList;
        } else {
          // Use environments array (names) instead of environmentIds
          const accessList =
            userAccess.environments || (userAccess as any).environments || [];
          accessibleEnvs = envList.filter((env) =>
            accessList.includes(env.environment),
          );
        }
      } catch (accessError) {
        console.warn(
          "[EnvironmentContext] Failed to load user access, allowing all environments:",
          accessError,
        );
        // If we can't load access permissions, allow all environments
        accessibleEnvs = envList;
      }

      console.log(
        "[EnvironmentContext] Accessible environments:",
        accessibleEnvs,
      );
      setEnvironments(accessibleEnvs);

      // Get the currently stored environment
      const storedEnv = getStoredEnvironment();

      // If no environment is selected, select the first one (or default)
      if (!storedEnv && accessibleEnvs.length > 0) {
        // Prefer the first environment or the one marked as default
        const defaultEnv =
          accessibleEnvs.find((e) => e.isDefault) || accessibleEnvs[0];
        if (defaultEnv) {
          console.log(
            "[EnvironmentContext] Auto-selecting default environment:",
            defaultEnv.environment,
          );
          setCurrentEnvironmentId(defaultEnv.environment);
          storeEnvironment(defaultEnv.environment, defaultEnv.displayName);
        }
      } else if (
        storedEnv &&
        !accessibleEnvs.find((e) => e.environment === storedEnv)
      ) {
        // If the stored environment doesn't exist anymore or not accessible, reset to first
        if (accessibleEnvs.length > 0) {
          console.log(
            "[EnvironmentContext] Stored environment not found, resetting to first",
          );
          setCurrentEnvironmentId(accessibleEnvs[0].environment);
          storeEnvironment(
            accessibleEnvs[0].environment,
            accessibleEnvs[0].displayName,
          );
        } else {
          // No accessible environments - clear localStorage as well
          setCurrentEnvironmentId(null);
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_KEY_NAME);
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load environments";
      setError(errorMessage);
      console.error("Error loading environments:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch environments only when authenticated
  useEffect(() => {
    console.log(
      "[EnvironmentContext] isAuthenticated changed:",
      isAuthenticated,
    );
    if (isAuthenticated) {
      console.log("[EnvironmentContext] Loading environments...");
      loadEnvironments();
    } else {
      // Reset when unauthenticated
      setEnvironments([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, loadEnvironments]);

  // Switch to a different environment
  const switchEnvironment = useCallback(
    (environment: string) => {
      const env = environments.find((e) => e.environment === environment);
      if (env) {
        setCurrentEnvironmentId(environment);
        storeEnvironment(environment, env.displayName);

        // Dispatch custom event to notify other components
        window.dispatchEvent(
          new CustomEvent("environment-changed", {
            detail: { environment, env },
          }),
        );
      }
    },
    [environments],
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

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
};

export const useEnvironment = (): EnvironmentContextType => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error(
      "useEnvironment must be used within an EnvironmentProvider",
    );
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
