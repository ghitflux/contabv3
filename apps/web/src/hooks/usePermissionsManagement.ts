/**
 * usePermissionsManagement Hook
 * Manages permissions and role-based access control
 */

import { useState, useCallback } from 'react';
import { permissionsApi } from '@/lib/api/endpoints/settings';
import type { Permission, RolePermission } from '@/types/settings';

export interface RolePermissionsResponse {
  role: string;
  permissions: Array<{
    permission_id: string;
    granted: boolean;
  }>;
}

export function usePermissionsManagement() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllPermissions = useCallback(async (category?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await permissionsApi.listPermissions(0, 1000, category);
      setPermissions(response.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch permissions';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRolePermissions = useCallback(async (role: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await permissionsApi.getRolePermissions(role);
      const permMap: Record<string, boolean> = {};

      if (response.permissions && Array.isArray(response.permissions)) {
        response.permissions.forEach((p: any) => {
          permMap[p.permission_id] = p.granted;
        });
      }

      setRolePermissions(permMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch role permissions';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateRolePermissions = useCallback(async (role: string, permissions: Record<string, boolean>) => {
    setIsLoading(true);
    setError(null);
    try {
      await permissionsApi.updateRolePermissions(role, permissions);
      setRolePermissions(permissions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update role permissions';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const togglePermission = useCallback((permissionId: string, granted: boolean) => {
    setRolePermissions((prev) => ({
      ...prev,
      [permissionId]: granted,
    }));
  }, []);

  return {
    permissions,
    rolePermissions,
    isLoading,
    error,
    fetchAllPermissions,
    fetchRolePermissions,
    updateRolePermissions,
    togglePermission,
  };
}
