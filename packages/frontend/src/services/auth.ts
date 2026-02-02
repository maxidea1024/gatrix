import { apiService } from "./api";
import { LoginCredentials, RegisterData, AuthResponse, User } from "@/types";
import { devLogger } from "@/utils/logger";

export class AuthService {
  static async login(
    credentials: LoginCredentials & { rememberMe?: boolean },
  ): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthResponse>(
        "/auth/login",
        credentials,
      );

      if (response.success && response.data) {
        // Set the access token for future requests
        apiService.setAccessToken(response.data.accessToken);

        // Store user data in localStorage
        localStorage.setItem("user", JSON.stringify(response.data.user));
        localStorage.setItem("accessToken", response.data.accessToken);

        // Handle Remember Me functionality
        if (credentials.rememberMe) {
          // Store login credentials for auto-fill (encrypted for security)
          localStorage.setItem("rememberedEmail", credentials.email);
          localStorage.setItem("rememberMe", "true");
        } else {
          // Clear remembered credentials if not checked
          localStorage.removeItem("rememberedEmail");
          localStorage.removeItem("rememberMe");
        }

        return response.data;
      }

      throw new Error(response.error?.message || "Login failed");
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
    try {
      const response = await apiService.post<{ user: User }>(
        "/auth/register",
        data,
      );

      if (response.success && response.data) {
        return response.data.user;
      }

      throw new Error(response.error?.message || "REGISTRATION_FAILED");
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

  static async logout(): Promise<void> {
    try {
      await apiService.post("/auth/logout");
    } catch (error) {
      // Continue with logout even if API call fails
      devLogger.warn("Logout API call failed:", error);
    } finally {
      // Clear local storage and tokens
      this.clearAuthData();

      // Don't clear remembered credentials on logout
      // They should persist until user unchecks "Remember Me" on next login
    }
  }

  static async refreshToken(): Promise<string> {
    const response = await apiService.post<{ accessToken: string }>(
      "/auth/refresh",
    );

    if (response.success && response.data) {
      const { accessToken } = response.data;

      // Update stored token
      apiService.setAccessToken(accessToken);
      localStorage.setItem("accessToken", accessToken);

      return accessToken;
    }

    throw new Error(response.error?.message || "Token refresh failed");
  }

  static async getProfile(): Promise<User> {
    const response = await apiService.get<{ user: User }>("/auth/profile");

    if (response.success && response.data) {
      // Update stored user data
      localStorage.setItem("user", JSON.stringify(response.data.user));
      return response.data.user;
    }

    throw new Error(response.error?.message || "Failed to get profile");
  }

  static async updateProfile(data: {
    name?: string;
    avatarUrl?: string;
    preferredLanguage?: string;
  }): Promise<User> {
    // Only send defined fields
    const backendData: any = {};
    if (data.name !== undefined) backendData.name = data.name;
    if (data.avatarUrl !== undefined) backendData.avatarUrl = data.avatarUrl;
    if (data.preferredLanguage !== undefined)
      backendData.preferredLanguage = data.preferredLanguage;

    const response = await apiService.put<{ user: User }>(
      "/auth/profile",
      backendData,
    );

    if (response.success && response.data) {
      // Update stored user data
      localStorage.setItem("user", JSON.stringify(response.data.user));
      return response.data.user;
    }

    throw new Error(response.error?.message || "Failed to update profile");
  }

  static async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const response = await apiService.post("/auth/change-password", {
      currentPassword,
      newPassword,
    });

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to change password");
    }
  }

  static async verifyEmail(): Promise<void> {
    const response = await apiService.post("/auth/verify-email");

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to verify email");
    }
  }

  // Local storage helpers
  static getStoredUser(): User | null {
    try {
      const userStr = localStorage.getItem("user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      devLogger.error("Failed to parse stored user:", error);
      return null;
    }
  }

  static getStoredToken(): string | null {
    return localStorage.getItem("accessToken");
  }

  static clearAuthData(): void {
    localStorage.removeItem("user");
    localStorage.removeItem("accessToken");
    apiService.clearTokens();
  }

  // Remember Me functionality
  static getRememberedEmail(): string | null {
    return localStorage.getItem("rememberedEmail");
  }

  static isRememberMeEnabled(): boolean {
    return localStorage.getItem("rememberMe") === "true";
  }

  static clearRememberedCredentials(): void {
    localStorage.removeItem("rememberedEmail");
    localStorage.removeItem("rememberMe");
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
    return this.hasRole("admin");
  }

  static isActive(): boolean {
    const user = this.getStoredUser();
    return user?.status === "active";
  }

  // Check if token is expired
  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      // Add 60 second buffer to refresh before actual expiry
      return now >= exp - 60000;
    } catch (error) {
      devLogger.error("Failed to decode token:", error);
      return true; // Treat invalid tokens as expired
    }
  }

  // Initialize auth state from localStorage
  static initializeAuth(): boolean {
    const token = this.getStoredToken();
    if (token) {
      // Check if token is expired
      if (this.isTokenExpired(token)) {
        devLogger.warn("⚠️ Stored token is expired, clearing auth data");
        this.clearAuthData();
        return false;
      }
      apiService.setAccessToken(token);
      return true;
    }
    return false;
  }

  // OAuth helpers
  static getGoogleAuthUrl(): string {
    return "/api/v1/auth/google";
  }

  static getGitHubAuthUrl(): string {
    return "/api/v1/auth/github";
  }

  static getQQAuthUrl(): string {
    return "/api/v1/auth/qq";
  }

  static getWeChatAuthUrl(): string {
    return "/api/v1/auth/wechat";
  }

  static getBaiduAuthUrl(): string {
    return "/api/v1/auth/baidu";
  }

  static handleOAuthCallback(token: string): void {
    // Store the token and redirect based on user status
    localStorage.setItem("accessToken", token);
    apiService.setAccessToken(token);

    // Fetch user profile
    this.getProfile()
      .then((user) => {
        // Redirect based on user status
        if (user.status === "pending") {
          window.location.href = "/auth/pending";
        } else if (user.status === "suspended") {
          window.location.href = "/account-suspended";
        } else if (user.status === "active") {
          window.location.href = "/dashboard";
        } else {
          // Unknown status, redirect to login
          window.location.href = "/login";
        }
      })
      .catch((error) => {
        devLogger.error("Failed to get profile after OAuth:", error);
        window.location.href = "/login";
      });
  }

  static async forgotPassword(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiService.post<{
      success: boolean;
      message: string;
    }>("/auth/forgot-password", { email });

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || "Failed to send reset email");
  }

  static async validateResetToken(
    token: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiService.get<{
      success: boolean;
      message: string;
    }>(`/auth/validate-reset-token/${token}`);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(
      response.error?.message || "Failed to validate reset token",
    );
  }

  static async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiService.post<{
      success: boolean;
      message: string;
    }>("/auth/reset-password", { token, newPassword });

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || "Failed to reset password");
  }
}

export const authService = AuthService;
