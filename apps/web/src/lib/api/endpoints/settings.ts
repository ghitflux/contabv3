/**
 * Settings API Endpoints
 */

import { apiClient } from '../client';
import type {
  SystemSettings,
  SystemSettingsUpdate,
  UserSettings,
  UserSettingsUpdate,
  SecuritySettings,
  SecuritySettingsUpdate,
  ClientDefaultSettings,
  ClientDefaultSettingsUpdate,
} from '@/types/settings';

export const settingsApi = {
  // User Settings
  async getMySettings(): Promise<UserSettings> {
    return apiClient.get('/settings/me');
  },

  async updateMySettings(data: UserSettingsUpdate): Promise<UserSettings> {
    return apiClient.put('/settings/me', data);
  },

  // System Settings (Admin only)
  async getSystemSettings(): Promise<SystemSettings> {
    return apiClient.get('/settings/system');
  },

  async updateSystemSettings(data: SystemSettingsUpdate): Promise<SystemSettings> {
    return apiClient.put('/settings/system', data);
  },

  // Security Settings (Admin only)
  async getSecuritySettings(): Promise<SecuritySettings> {
    return apiClient.get('/settings/security');
  },

  async updateSecuritySettings(data: SecuritySettingsUpdate): Promise<SecuritySettings> {
    return apiClient.put('/settings/security', data);
  },

  // Client Default Settings (Admin only)
  async getClientDefaults(): Promise<ClientDefaultSettings> {
    return apiClient.get('/settings/clients/defaults');
  },

  async updateClientDefaults(data: ClientDefaultSettingsUpdate): Promise<ClientDefaultSettings> {
    return apiClient.put('/settings/clients/defaults', data);
  },
};

export const permissionsApi = {
  // List all permissions
  async listPermissions(skip: number = 0, limit: number = 100, category?: string) {
    const params = new URLSearchParams();
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    if (category) params.append('category', category);

    return apiClient.get(`/permissions?${params.toString()}`);
  },

  // Get specific permission
  async getPermission(permissionId: string) {
    return apiClient.get(`/permissions/${permissionId}`);
  },

  // Get role permissions
  async getRolePermissions(role: string) {
    return apiClient.get(`/permissions/roles/${role}/permissions`);
  },

  // Update role permissions
  async updateRolePermissions(role: string, permissions: Record<string, boolean>) {
    return apiClient.put(`/permissions/roles/${role}/permissions`, {
      permissions,
    });
  },
};
