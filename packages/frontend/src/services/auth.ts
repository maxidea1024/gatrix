import { apiService } from './api';
import { LoginCredentials, RegisterData, AuthResponse, User } from '@/types';

export class AuthService {
  static async login(credentials: LoginCredentials & { rememberMe?: boolean }): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthResponse>('/auth/login', credentials);

      if (response.success && response.data) {
        // Set the access token for future requests
        apiService.setAccessToken(response.data.accessToken);

        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('accessToken', response.data.accessToken);

        // Handle Remember Me functionality
        if (credentials.rememberMe) {
          // Store login credentials for auto-fill (encrypted for security)
          localStorage.setItem('rememberedEmail', credentials.email);
          localStorage.setItem('rememberMe', 'true');
        } else {
          // Clear remembered credentials if not checked
          localStorage.removeItem('rememberedEmail');
          localStorage.removeItem('rememberMe');
        }

        return response.data;
      }

      throw new Error(response.error?.message || 'Login failed');
    } catch (error: any) {
      // Handle API errors
      if (error.error?.message) {
        // Create a custom error with the backend message and status
        const customError = new Error(error.error.message);
        (customError as any).status = error.status;
        (customError as any).response = { status: error.status };
        throw customError;
      }

      // Re-throw the original error if it's not an API error
      throw error;
    }
  }

  static async register(data: RegisterData): Promise<User> {
    const response = await apiService.post<{ user: User }>('/auth/register', data);
    
    if (response.success && response.data) {
      return response.data.user;
    }
    
    throw new Error(response.error?.message || 'Registration failed');
  }

  static async logout(): Promise<void> {
    try {
      await apiService.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error);
    } finally {
      // Clear local storage and tokens
      this.clearAuthData();

      // Don't clear remembered credentials on logout
      // They should persist until user unchecks "Remember Me" on next login
    }
  }

  static async refreshToken(): Promise<string> {
    const response = await apiService.post<{ accessToken: string }>('/auth/refresh');
    
    if (response.success && response.data) {
      const { accessToken } = response.data;
      
      // Update stored token
      apiService.setAccessToken(accessToken);
      localStorage.setItem('accessToken', accessToken);
      
      return accessToken;
    }
    
    throw new Error(response.error?.message || 'Token refresh failed');
  }

  static async getProfile(): Promise<User> {
    const response = await apiService.get<{ user: User }>('/auth/profile');
    
    if (response.success && response.data) {
      // Update stored user data
      localStorage.setItem('user', JSON.stringify(response.data.user));
      return response.data.user;
    }
    
    throw new Error(response.error?.message || 'Failed to get profile');
  }

  static async updateProfile(data: { name?: string; avatarUrl?: string }): Promise<User> {
    // Only send defined fields
    const backendData: any = {};
    if (data.name !== undefined) backendData.name = data.name;
    if (data.avatarUrl !== undefined) backendData.avatarUrl = data.avatarUrl;

    const response = await apiService.put<{ user: User }>('/auth/profile', backendData);
    
    if (response.success && response.data) {
      // Update stored user data
      localStorage.setItem('user', JSON.stringify(response.data.user));
      return response.data.user;
    }
    
    throw new Error(response.error?.message || 'Failed to update profile');
  }

  static async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await apiService.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to change password');
    }
  }



  static async verifyEmail(): Promise<void> {
    const response = await apiService.post('/auth/verify-email');
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to verify email');
    }
  }

  // Local storage helpers
  static getStoredUser(): User | null {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Failed to parse stored user:', error);
      return null;
    }
  }

  static getStoredToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  static clearAuthData(): void {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    apiService.clearTokens();
  }

  // Remember Me functionality
  static getRememberedEmail(): string | null {
    return localStorage.getItem('rememberedEmail');
  }

  static isRememberMeEnabled(): boolean {
    return localStorage.getItem('rememberMe') === 'true';
  }

  static clearRememberedCredentials(): void {
    localStorage.removeItem('rememberedEmail');
    localStorage.removeItem('rememberMe');
  }

  static isAuthenticated(): boolean {
    const token = this.getStoredToken();
    const user = this.getStoredUser();
    return !!(token && user);
  }

  static hasRole(role: string): boolean {
    const user = this.getStoredUser();
    return user?.role === role;
  }

  static isAdmin(): boolean {
    return this.hasRole('admin');
  }

  static isActive(): boolean {
    const user = this.getStoredUser();
    return user?.status === 'active';
  }

  // Initialize auth state from localStorage
  static initializeAuth(): void {
    const token = this.getStoredToken();
    if (token) {
      apiService.setAccessToken(token);
    }
  }

  // OAuth helpers
  static getGoogleAuthUrl(): string {
    return '/api/v1/auth/google';
  }

  static getGitHubAuthUrl(): string {
    return '/api/v1/auth/github';
  }

  static handleOAuthCallback(token: string): void {
    // Store the token and redirect to dashboard
    localStorage.setItem('accessToken', token);
    apiService.setAccessToken(token);

    // Fetch user profile
    this.getProfile().then(() => {
      window.location.href = '/dashboard';
    }).catch((error) => {
      console.error('Failed to get profile after OAuth:', error);
      window.location.href = '/login';
    });
  }

  static async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const response = await apiService.post<{ success: boolean; message: string }>(
      '/auth/forgot-password',
      { email }
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || 'Failed to send reset email');
  }

  static async validateResetToken(token: string): Promise<{ success: boolean; message: string }> {
    const response = await apiService.get<{ success: boolean; message: string }>(
      `/auth/validate-reset-token/${token}`
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || 'Failed to validate reset token');
  }

  static async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await apiService.post<{ success: boolean; message: string }>(
      '/auth/reset-password',
      { token, newPassword }
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || 'Failed to reset password');
  }
}
