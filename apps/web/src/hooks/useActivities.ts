/**
 * Hook for activities CRUD and state management.
 */

import { useCallback, useState } from "react";
import { activitiesApi } from "@/lib/api/endpoints/activities";
import type {
  Activity,
  ActivityCreate,
  ActivityFilters,
  ActivityListResponse,
  ActivityUpdate,
} from "@/types/activity";

function normalizeActivity(activity: any): Activity {
  const labels =
    Array.isArray(activity?.labels)
      ? activity.labels
      : typeof activity?.labels === "string" && activity.labels.length
        ? activity.labels.split(",").map((label: string) => label.trim()).filter(Boolean)
        : [];

  return {
    ...activity,
    labels,
    reminders: Boolean(activity?.reminders),
    due_date: activity?.due_date ?? null,
    assigned_to_name:
      activity?.assigned_to_name ??
      activity?.assigned_to?.name ??
      activity?.assigned_to ??
      null,
  };
}

export function useActivities() {
  const [activities, setActivities] = useState<ActivityListResponse | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<ActivityFilters | undefined>();

  const fetchActivities = useCallback(
    async (filters?: ActivityFilters) => {
      setIsLoading(true);
      setError(null);
      setLastFilters(filters);

      try {
        const data = await activitiesApi.list(filters);
        const normalized: ActivityListResponse = {
          ...data,
          items: data.items.map(normalizeActivity),
        };
        setActivities(normalized);
        return normalized;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch activities";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const fetchActivityById = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const activity = normalizeActivity(await activitiesApi.getById(id));
      setSelectedActivity(activity);
      return activity;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch activity";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createActivity = useCallback(
    async (data: ActivityCreate) => {
      setIsLoading(true);
      setError(null);

      try {
        const created = normalizeActivity(await activitiesApi.create(data));
        setActivities((prev) => {
          if (!prev) {
            return {
              items: [created],
              total: 1,
              page: 1,
              size: lastFilters?.size ?? 50,
              pages: 1,
            };
          }
          return {
            ...prev,
            items: [created, ...prev.items],
            total: prev.total + 1,
          };
        });
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create activity";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [lastFilters],
  );

  const updateActivity = useCallback(
    async (id: string, data: ActivityUpdate) => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = normalizeActivity(await activitiesApi.update(id, data));
        setActivities((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((item) => (item.id === id ? updated : item)),
          };
        });
        if (selectedActivity?.id === id) {
          setSelectedActivity(updated);
        }
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update activity";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedActivity],
  );

  const deleteActivity = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await activitiesApi.delete(id);
      setActivities((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.filter((item) => item.id !== id),
          total: Math.max(prev.total - 1, 0),
        };
      });
      if (selectedActivity?.id === id) {
        setSelectedActivity(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete activity";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [selectedActivity]);

  return {
    activities,
    selectedActivity,
    isLoading,
    error,
    fetchActivities,
    fetchActivityById,
    createActivity,
    updateActivity,
    deleteActivity,
    setSelectedActivity,
  };
}
