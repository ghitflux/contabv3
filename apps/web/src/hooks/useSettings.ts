/**
 * useSettings Hook
 * Manages user and system settings
 */

import { useState, useCallback } from 'react';
import { settingsApi } from '@/lib/api/endpoints/settings';
import type {
  UserSettings,
  UserSettingsUpdate,
  SystemSettings,
  SystemSettingsUpdate,
  SecuritySettings,
  SecuritySettingsUpdate,
  ClientDefaultSettings,
  ClientDefaultSettingsUpdate,
} from '@/types/settings';

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await settingsApi.getMySettings();
      setSettings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch settings';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSettings = useCallback(
    async (data: UserSettingsUpdate) => {
      setIsLoading(true);
      setError(null);
      try {
        const updated = await settingsApi.updateMySettings(data);
        setSettings(updated);
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update settings';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    settings,
    isLoading,
    error,
    fetchSettings,
    updateSettings,
  };
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await settingsApi.getSystemSettings();
      setSettings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch system settings';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSettings = useCallback(
    async (data: SystemSettingsUpdate) => {
      setIsLoading(true);
      setError(null);
      try {
        const updated = await settingsApi.updateSystemSettings(data);
        setSettings(updated);
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update system settings';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    settings,
    isLoading,
    error,
    fetchSettings,
    updateSettings,
  };
}

export function useSecuritySettings() {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await settingsApi.getSecuritySettings();
      setSettings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch security settings';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSettings = useCallback(
    async (data: SecuritySettingsUpdate) => {
      setIsLoading(true);
      setError(null);
      try {
        const updated = await settingsApi.updateSecuritySettings(data);
        setSettings(updated);
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update security settings';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    settings,
    isLoading,
    error,
    fetchSettings,
    updateSettings,
  };
}

export function useClientDefaultSettings() {
  const [settings, setSettings] = useState<ClientDefaultSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await settingsApi.getClientDefaults();
      setSettings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch client defaults';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSettings = useCallback(
    async (data: ClientDefaultSettingsUpdate) => {
      setIsLoading(true);
      setError(null);
      try {
        const updated = await settingsApi.updateClientDefaults(data);
        setSettings(updated);
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update client defaults';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    settings,
    isLoading,
    error,
    fetchSettings,
    updateSettings,
  };
}
