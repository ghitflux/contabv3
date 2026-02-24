/**
 * Activities API endpoints.
 */

import { apiClient } from '../client';
import type {
  Activity,
  ActivityCreate,
  ActivityFilters,
  ActivityListResponse,
  ActivityUpdate,
} from '@/types/activity';

export const activitiesApi = {
  async list(filters?: ActivityFilters): Promise<ActivityListResponse> {
    const params = new URLSearchParams();

    if (filters?.query) params.append('query', filters.query);
    if (filters?.status) params.append('status', filters.status.toString());
    if (filters?.priority) params.append('priority', filters.priority.toString());
    if (filters?.assigned_to_id) params.append('assigned_to_id', filters.assigned_to_id);
    if (filters?.due_date) params.append('due_date', filters.due_date);

    const size = Math.max(1, Math.min(100, Math.trunc(filters?.size ?? 100)));
    const page = Math.max(1, Math.trunc(filters?.page ?? 1));

    params.append('skip', String((page - 1) * size));
    params.append('limit', String(size));

    const queryString = params.toString();
    const endpoint = queryString ? `/activities?${queryString}` : '/activities';

    return apiClient.get<ActivityListResponse>(endpoint);
  },

  async getById(id: string): Promise<Activity> {
    return apiClient.get<Activity>(`/activities/${id}`);
  },

  async create(data: ActivityCreate): Promise<Activity> {
    return apiClient.post<Activity>('/activities', data);
  },

  async update(id: string, data: ActivityUpdate): Promise<Activity> {
    return apiClient.put<Activity>(`/activities/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/activities/${id}`);
  },
};
