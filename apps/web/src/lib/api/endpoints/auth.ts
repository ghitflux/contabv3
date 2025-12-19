/**
 * Authentication API endpoints
 */

import { apiClient } from "../client";
import type {
  LoginRequest,
  TokenResponse,
  RefreshRequest,
  RefreshResponse,
  LogoutRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
} from "@/types/auth";
import type { User } from "@/types/user";

export const authApi = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    const response = await apiClient.post<TokenResponse>(
      "/auth/login",
      credentials
    );

    // Store tokens in apiClient
    if (response.access_token && response.refresh_token) {
      apiClient.setTokens(response.access_token, response.refresh_token);
    }

    return response;
  },

  /**
   * Logout current user
   */
  async logout(request?: LogoutRequest): Promise<void> {
    try {
      await apiClient.post("/auth/logout", request);
    } finally {
      // Always clear tokens, even if request fails
      apiClient.clearTokens();
    }
  },

  /**
   * Get current user information
   */
  async me(): Promise<User> {
    return apiClient.get<User>("/users/me");
  },

  /**
   * Refresh access token
   */
  async refresh(refreshToken: string): Promise<RefreshResponse> {
    const request: RefreshRequest = { refresh_token: refreshToken };
    const response = await apiClient.post<RefreshResponse>(
      "/auth/refresh",
      request
    );

    // Update access token in apiClient
    if (response.access_token && apiClient.getAccessToken()) {
      apiClient.setTokens(
        response.access_token,
        refreshToken // Keep the same refresh token
      );
    }

    return response;
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<void> {
    await apiClient.post("/auth/password-reset", request);
  },

  /**
   * Confirm password reset with token
   */
  async confirmPasswordReset(request: PasswordResetConfirm): Promise<void> {
    await apiClient.post("/auth/password-reset/confirm", request);
  },
};
