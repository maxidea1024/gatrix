import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@/types';
import { AuthService } from '@/services/auth';
import { devLogger } from '@/utils/logger';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user;

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
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  const register = async (data: any): Promise<void> => {
    try {
      // Don't set isLoading here - it's for initial auth check only
      // Individual pages should manage their own loading states
      setError(null);
      const response = await AuthService.register(data);
      setUser(response);
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
          console.log('Token expired, clearing auth data');
          AuthService.clearAuthData();
          setUser(null);
          return;
        }
      } catch (tokenError) {
        console.error('Invalid token format:', tokenError);
        AuthService.clearAuthData();
        setUser(null);
        return;
      }

      // Try to get fresh profile to validate token with server
      const user = await AuthService.getProfile();
      setUser(user);
    } catch (error) {
      console.error('Auth refresh error:', error);
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

  useEffect(() => {
    // Initialize auth state from localStorage only
    const initializeAuth = async () => {
      const startTime = Date.now();
      const MIN_LOADING_TIME = 1500; // Minimum 1.5 seconds for better UX

      try {
        console.log('🔄 AuthContext: Starting initialization...');
        setIsLoading(true);

        // Check if we have stored auth data
        const storedToken = AuthService.getStoredToken();
        const storedUser = AuthService.getStoredUser();

        console.log('🔍 AuthContext: Stored token exists:', !!storedToken);
        console.log('🔍 AuthContext: Stored user exists:', !!storedUser);

        if (storedToken && storedUser) {
          // Initialize API service with stored token (checks expiry)
          const isValid = AuthService.initializeAuth();
          if (isValid) {
            // Use stored user data without API call to prevent infinite loop
            setUser(storedUser);
            console.log('✅ AuthContext: User authenticated from storage');
          } else {
            // Token was expired and cleared
            setUser(null);
            console.log('❌ AuthContext: Stored token expired, user logged out');
          }
        } else if (storedToken && !storedUser) {
          // Token exists but no user data - fetch profile (OAuth callback scenario)
          console.log('🔄 AuthContext: Token exists but no user data, fetching profile...');
          const isValid = AuthService.initializeAuth();
          if (isValid) {
            try {
              const user = await AuthService.getProfile();
              setUser(user);
              console.log('✅ AuthContext: User profile fetched successfully');
            } catch (error) {
              console.error('❌ AuthContext: Failed to fetch user profile:', error);
              AuthService.clearAuthData();
              setUser(null);
            }
          } else {
            // Token was expired
            setUser(null);
            console.log('❌ AuthContext: Stored token expired, user logged out');
          }
        } else {
          // No stored auth data
          setUser(null);
          console.log('❌ AuthContext: No stored auth data, user not authenticated');
        }
      } catch (error) {
        console.error('❌ AuthContext: Auth initialization error:', error);
        AuthService.clearAuthData();
        setUser(null);
      } finally {
        // Ensure minimum loading time for better UX
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

        if (remainingTime > 0) {
          console.log(`⏱️ AuthContext: Waiting ${remainingTime}ms for minimum loading time...`);
          setTimeout(() => {
            setIsLoading(false);
            console.log('✅ AuthContext: Initialization complete, isLoading = false');
          }, remainingTime);
        } else {
          setIsLoading(false);
          console.log('✅ AuthContext: Initialization complete, isLoading = false');
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
    login,
    register,
    logout,
    refreshAuth,
    clearError,
    isAdmin,
    canAccess,
    getToken,
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
