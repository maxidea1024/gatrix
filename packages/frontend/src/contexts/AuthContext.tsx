import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Permission } from '@/types';
import { AuthService } from '@/services/auth';
import { devLogger } from '@/utils/logger';
import api from '@/services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  permissions: Permission[];
  permissionsLoading: boolean;
  login: (credentials: { email: string; password: string; rememberMe?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  register?: (data: any) => Promise<void>;
  updateProfile?: (data: any) => Promise<User>;
  changePassword?: (currentPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
  isAdmin: () => boolean;
  canAccess: (requiredRoles?: string[]) => boolean;
  getToken: () => string | null;
  hasPermission: (permission: Permission | Permission[]) => boolean;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  // Start with true so menus are hidden until permissions are loaded
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Fetch user permissions from the server
  const fetchPermissions = useCallback(async (userId: number) => {
    try {
      setPermissionsLoading(true);
      const response = await api.get<{ userId: number; permissions: Permission[] }>(
        `/admin/users/${userId}/permissions`
      );
      setPermissions(response.data?.permissions || []);
    } catch (error) {
      devLogger.error('Failed to fetch permissions:', error);
      setPermissions([]);
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

  // Refresh permissions
  const refreshPermissions = useCallback(async () => {
    if (user?.id) {
      await fetchPermissions(user.id);
    }
  }, [user?.id, fetchPermissions]);

  const login = async (credentials: { email: string; password: string; rememberMe?: boolean }): Promise<void> => {
    try {
      // Don't set isLoading here - it's for initial auth check only
      // Individual pages should manage their own loading states
      setError(null);
      const response = await AuthService.login(credentials);
      setUser(response.user);
    } catch (error: any) {
      setError(error.message || 'Login failed');
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await AuthService.logout();
    } catch (error) {
      devLogger.error('Logout error:', error);
    } finally {
      setUser(null);
      setPermissions([]);
    }
  };

  const register = async (data: any): Promise<void> => {
    try {
      // Don't set isLoading here - it's for initial auth check only
      // Individual pages should manage their own loading states
      setError(null);
      await AuthService.register(data);
      // Don't set user here - registration doesn't log the user in
      // User needs to be approved by admin first (status: 'pending')
    } catch (error: any) {
      setError(error.message || 'Registration failed');
      throw error;
    }
  };

  const refreshAuth = async (): Promise<void> => {
    try {
      setIsLoading(true);

      // Check if we have a token first
      const token = AuthService.getStoredToken();
      if (!token) {
        setUser(null);
        return;
      }

      // Validate token by checking if it's expired
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;

        if (payload.exp && payload.exp < currentTime) {
          // Token is expired
          devLogger.info('Token expired, clearing auth data');
          AuthService.clearAuthData();
          setUser(null);
          return;
        }
      } catch (tokenError) {
        devLogger.error('Invalid token format:', tokenError);
        AuthService.clearAuthData();
        setUser(null);
        return;
      }

      // Try to get fresh profile to validate token with server
      const user = await AuthService.getProfile();
      setUser(user);
    } catch (error) {
      devLogger.error('Auth refresh error:', error);
      // Clear auth data on error to prevent infinite loops
      AuthService.clearAuthData();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = (): void => {
    setError(null);
  };

  const isAdmin = (): boolean => {
    return user?.role === 'admin';
  };

  const canAccess = (requiredRoles?: string[]): boolean => {
    if (!isAuthenticated || !user) {
      return false;
    }

    if (user.status !== 'active') {
      return false;
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    return requiredRoles.includes(user.role);
  };

  const getToken = (): string | null => {
    return AuthService.getStoredToken();
  };

  // Check if user has a specific permission or any of the permissions
  const hasPermission = useCallback((permission: Permission | Permission[]): boolean => {
    console.log(`[hasPermission] Checking: ${JSON.stringify(permission)}`);
    console.log(`[hasPermission] isAuthenticated: ${isAuthenticated}, user: ${user?.email}, role: ${user?.role}`);
    console.log(`[hasPermission] permissionsLoading: ${permissionsLoading}, permissions: ${JSON.stringify(permissions)}`);

    if (!isAuthenticated || !user) {
      console.log(`[hasPermission] Return false - not authenticated or no user`);
      return false;
    }

    // Admin users with role 'admin' need to have permissions assigned
    if (user.role !== 'admin') {
      console.log(`[hasPermission] Return false - not admin role`);
      return false;
    }

    // While permissions are loading, return false to prevent showing menus prematurely
    if (permissionsLoading) {
      console.log(`[hasPermission] Return false - permissions loading`);
      return false;
    }

    // Check for wildcard permission '*' that grants all permissions
    if (permissions.includes('*')) {
      console.log(`[hasPermission] Return true - has wildcard permission`);
      return true;
    }

    const requiredPermissions = Array.isArray(permission) ? permission : [permission];
    const result = requiredPermissions.some(p => permissions.includes(p));
    console.log(`[hasPermission] Result: ${result}`);
    return result;
  }, [isAuthenticated, user, permissions, permissionsLoading]);

  // Fetch permissions when user changes
  useEffect(() => {
    if (user?.id && user.role === 'admin') {
      fetchPermissions(user.id);
    } else {
      setPermissions([]);
      setPermissionsLoading(false); // Non-admin users don't need permission loading
    }
  }, [user?.id, user?.role, fetchPermissions]);

  useEffect(() => {
    // Initialize auth state from localStorage only
    const initializeAuth = async () => {
      const startTime = Date.now();
      const MIN_LOADING_TIME = 1500; // Minimum 1.5 seconds for better UX

      try {
        devLogger.info('🔄 AuthContext: Starting initialization...');
        setIsLoading(true);

        // Check if we have stored auth data
        const storedToken = AuthService.getStoredToken();
        const storedUser = AuthService.getStoredUser();

        devLogger.debug('🔍 AuthContext: Stored token exists:', !!storedToken);
        devLogger.debug('🔍 AuthContext: Stored user exists:', !!storedUser);

        if (storedToken && storedUser) {
          // Initialize API service with stored token (checks expiry)
          const isValid = AuthService.initializeAuth();
          if (isValid) {
            // Use stored user data without API call to prevent infinite loop
            setUser(storedUser);
            devLogger.info('✅ AuthContext: User authenticated from storage');
          } else {
            // Token was expired and cleared
            setUser(null);
            devLogger.info('❌ AuthContext: Stored token expired, user logged out');
          }
        } else if (storedToken && !storedUser) {
          // Token exists but no user data - fetch profile (OAuth callback scenario)
          devLogger.info('🔄 AuthContext: Token exists but no user data, fetching profile...');
          const isValid = AuthService.initializeAuth();
          if (isValid) {
            try {
              const user = await AuthService.getProfile();
              setUser(user);
              devLogger.info('✅ AuthContext: User profile fetched successfully');
            } catch (error: any) {
              devLogger.error('❌ AuthContext: Failed to fetch user profile:', error);

              // Check if this is a "user not found" error
              if (error?.response?.status === 404 &&
                  (error?.response?.data?.message === 'USER_NOT_FOUND' ||
                   error?.response?.data?.error?.message === 'USER_NOT_FOUND' ||
                   error?.response?.data?.message?.includes('User not found'))) {
                // User was deleted - redirect to session expired page
                // The API interceptor will handle the redirect, just clear data here
                devLogger.warn('⚠️ AuthContext: User not found - account may have been deleted');
              }

              AuthService.clearAuthData();
              setUser(null);
            }
          } else {
            // Token was expired
            setUser(null);
            devLogger.info('❌ AuthContext: Stored token expired, user logged out');
          }
        } else {
          // No stored auth data
          setUser(null);
          devLogger.info('❌ AuthContext: No stored auth data, user not authenticated');
        }
      } catch (error) {
        devLogger.error('❌ AuthContext: Auth initialization error:', error);
        AuthService.clearAuthData();
        setUser(null);
      } finally {
        // Ensure minimum loading time for better UX
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

        if (remainingTime > 0) {
          devLogger.debug(`⏱️ AuthContext: Waiting ${remainingTime}ms for minimum loading time...`);
          setTimeout(() => {
            setIsLoading(false);
            devLogger.info('✅ AuthContext: Initialization complete, isLoading = false');
          }, remainingTime);
        } else {
          setIsLoading(false);
          devLogger.info('✅ AuthContext: Initialization complete, isLoading = false');
        }
      }
    };

    initializeAuth();
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    error,
    permissions,
    permissionsLoading,
    login,
    register,
    logout,
    refreshAuth,
    clearError,
    isAdmin,
    canAccess,
    getToken,
    hasPermission,
    refreshPermissions,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
