/**
 * useUserManagement Hook
 * Manages user listing, creation, and editing
 */

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import type { User } from '@/types/user';

export interface UserListResponse {
  items: User[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export function useUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (page: number = 1, limit: number = 10) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<UserListResponse>(
        `/users?skip=${(page - 1) * limit}&limit=${limit}`
      );
      setUsers(response.items);
      setTotal(response.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createUser = useCallback(
    async (userData: { name: string; email: string; password: string; role: string }) => {
      setIsLoading(true);
      setError(null);
      try {
        const newUser = await apiClient.post<User>('/users', userData);
        setUsers((prev) => [newUser, ...prev]);
        return newUser;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create user';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateUser = useCallback(
    async (userId: string, userData: Partial<User>) => {
      setIsLoading(true);
      setError(null);
      try {
        const updated = await apiClient.put<User>(`/users/${userId}`, userData);
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? updated : u))
        );
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update user';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const deactivateUser = useCallback(
    async (userId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const updated = await apiClient.put<User>(`/users/${userId}`, {
          is_active: false,
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? updated : u))
        );
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to deactivate user';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    users,
    total,
    isLoading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deactivateUser,
  };
}
