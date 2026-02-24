/**
 * Hook for activities CRUD and state management.
 */

import { useCallback, useState } from 'react';
import { activitiesApi } from '@/lib/api/endpoints/activities';
import { decodeActivityMetadata, encodeActivityLabels } from '@/lib/activityMetadata';
import type {
  Activity,
  ActivityCreate,
  ActivityFilters,
  ActivityListResponse,
  ActivityUpdate,
} from '@/types/activity';
import { normalizeDateOnly } from '@/types/activity';

function normalizeStatus(value: unknown): string {
  if (typeof value !== 'string') return 'todo';
  const normalized = value.toLowerCase();
  if (normalized === 'in_progress') return 'in-progress';
  if (['todo', 'in-progress', 'review', 'done'].includes(normalized)) return normalized;
  return 'todo';
}

function normalizePriority(value: unknown): string {
  if (typeof value !== 'string') return 'medium';
  const normalized = value.toLowerCase();
  if (['low', 'medium', 'high'].includes(normalized)) return normalized;
  return 'medium';
}

function sortActivities(items: Activity[]): Activity[] {
  return [...items].sort((a, b) => {
    const dueA = a.due_date ?? '9999-12-31';
    const dueB = b.due_date ?? '9999-12-31';
    if (dueA !== dueB) return dueA < dueB ? -1 : 1;
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createdB - createdA;
  });
}

function normalizeActivity(activity: any): Activity {
  const rawLabels = Array.isArray(activity?.labels)
    ? activity.labels
    : typeof activity?.labels === 'string' && activity.labels.length
      ? activity.labels
          .split(',')
          .map((label: string) => label.trim())
          .filter(Boolean)
      : [];

  const metadata = decodeActivityMetadata(rawLabels);
  const apiLinkedClientIds = Array.isArray(activity?.linked_client_ids)
    ? activity.linked_client_ids.filter(
        (value: unknown): value is string => typeof value === 'string'
      )
    : [];
  const linkedClientIds = Array.from(new Set([...metadata.linkedClientIds, ...apiLinkedClientIds]));
  const linkedObligationId =
    typeof activity?.linked_obligation_id === 'string'
      ? activity.linked_obligation_id
      : metadata.linkedObligationId;

  return {
    ...activity,
    status: normalizeStatus(activity?.status),
    priority: normalizePriority(activity?.priority),
    labels: metadata.displayLabels,
    reminders: Boolean(activity?.reminders),
    due_date: normalizeDateOnly(activity?.due_date),
    start_date: normalizeDateOnly(activity?.start_date) ?? metadata.startDate,
    end_date: normalizeDateOnly(activity?.end_date) ?? metadata.endDate,
    linked_client_ids: linkedClientIds,
    linked_obligation_id: linkedObligationId,
    is_obligation_activity: metadata.isObligationLinked || Boolean(linkedObligationId),
    assigned_to_name:
      activity?.assigned_to_name ?? activity?.assigned_to?.name ?? activity?.assigned_to ?? null,
  };
}

function prepareActivityPayload(
  data: ActivityCreate | ActivityUpdate
): ActivityCreate | ActivityUpdate {
  const payload: Record<string, unknown> = { ...data };

  if (Object.prototype.hasOwnProperty.call(payload, 'due_date')) {
    payload.due_date = normalizeDateOnly(payload.due_date) ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'labels')) {
    payload.labels = encodeActivityLabels({
      displayLabels: (payload.labels as string[] | null | undefined) ?? [],
      linkedClientIds: (payload.linked_client_ids as string[] | null | undefined) ?? undefined,
      linkedObligationId: (payload.linked_obligation_id as string | null | undefined) ?? undefined,
      startDate: (payload.start_date as string | null | undefined) ?? undefined,
      endDate: (payload.end_date as string | null | undefined) ?? undefined,
    });
  }

  delete payload.start_date;
  delete payload.end_date;
  delete payload.linked_client_ids;
  delete payload.linked_obligation_id;
  delete payload.is_obligation_activity;

  return payload as ActivityCreate | ActivityUpdate;
}

export function useActivities() {
  const [activities, setActivities] = useState<ActivityListResponse | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<ActivityFilters | undefined>();

  const fetchActivities = useCallback(async (filters?: ActivityFilters) => {
    setIsLoading(true);
    setError(null);
    setLastFilters(filters);

    try {
      const requestedSize = Math.max(1, Math.trunc(filters?.size ?? 100));
      const page = Math.max(1, Math.trunc(filters?.page ?? 1));
      const pageSize = Math.min(requestedSize, 100);

      let total = 0;
      let currentPage = page;
      let hasMore = true;
      const collectedItems: any[] = [];

      while (hasMore && collectedItems.length < requestedSize) {
        const response = await activitiesApi.list({
          ...filters,
          page: currentPage,
          size: pageSize,
        });

        total = response.total;
        collectedItems.push(...response.items);
        currentPage += 1;

        if (response.items.length < pageSize || collectedItems.length >= total) {
          hasMore = false;
        }
      }

      const items = collectedItems.slice(0, requestedSize).map(normalizeActivity);
      const normalized: ActivityListResponse = {
        items: sortActivities(items),
        total,
        page,
        size: requestedSize,
        pages: requestedSize > 0 ? Math.ceil(total / requestedSize) : 0,
      };
      setActivities(normalized);
      return normalized;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch activities';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchActivityById = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const activity = normalizeActivity(await activitiesApi.getById(id));
      setSelectedActivity(activity);
      return activity;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch activity';
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
        const created = normalizeActivity(
          await activitiesApi.create(prepareActivityPayload(data) as ActivityCreate)
        );
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
            items: sortActivities([created, ...prev.items]),
            total: prev.total + 1,
          };
        });
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create activity';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [lastFilters]
  );

  const updateActivity = useCallback(
    async (id: string, data: ActivityUpdate) => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = normalizeActivity(
          await activitiesApi.update(id, prepareActivityPayload(data))
        );
        setActivities((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: sortActivities(prev.items.map((item) => (item.id === id ? updated : item))),
          };
        });
        if (selectedActivity?.id === id) {
          setSelectedActivity(updated);
        }
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update activity';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedActivity]
  );

  const deleteActivity = useCallback(
    async (id: string) => {
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
        const message = err instanceof Error ? err.message : 'Failed to delete activity';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedActivity]
  );

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
