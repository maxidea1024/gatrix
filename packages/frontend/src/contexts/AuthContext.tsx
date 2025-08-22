import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@/types';
import { AuthService } from '@/services/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  register?: (data: any) => Promise<void>;
  updateProfile?: (data: any) => Promise<User>;
  changePassword?: (currentPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
  isAdmin: () => boolean;
  canAccess: (requiredRoles?: string[]) => boolean;
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

  const login = async (credentials: { email: string; password: string }): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await AuthService.login(credentials);
      setUser(response.user);
    } catch (error: any) {
      setError(error.message || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
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
      setIsLoading(true);
      setError(null);
      const response = await AuthService.register(data);
      setUser(response.user);
    } catch (error: any) {
      setError(error.message || 'Registration failed');
      throw error;
    } finally {
      setIsLoading(false);
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

      // Try to get fresh profile
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

  useEffect(() => {
    // Initialize auth state from localStorage only
    const initializeAuth = () => {
      try {
        console.log('🔄 AuthContext: Starting initialization...');
        setIsLoading(true);

        // Check if we have stored auth data
        const storedToken = AuthService.getStoredToken();
        const storedUser = AuthService.getStoredUser();

        console.log('🔍 AuthContext: Stored token exists:', !!storedToken);
        console.log('🔍 AuthContext: Stored user exists:', !!storedUser);

        if (storedToken && storedUser) {
          // Initialize API service with stored token
          AuthService.initializeAuth();
          // Use stored user data without API call to prevent infinite loop
          setUser(storedUser);
          console.log('✅ AuthContext: User authenticated from storage');
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
        setIsLoading(false);
        console.log('✅ AuthContext: Initialization complete, isLoading = false');
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
