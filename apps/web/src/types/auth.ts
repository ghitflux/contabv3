/**
 * Authentication types and interfaces.
 */

import { User } from "./user";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenData {
  sub: string; // User ID
  role: string;
  exp?: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // seconds
  user: User;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds
}

export interface LogoutRequest {
  refresh_token?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface ApiResponse<T = Record<string, unknown> | null> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

export interface PasswordResetRequestData {
  reset_token?: string | null;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}

export interface UpdatePasswordRequest {
  current_password: string;
  new_password: string;
}

/**
 * Auth state interface.
 */
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Auth context interface.
 */
export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (user: User) => void;
}
