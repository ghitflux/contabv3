/**
 * Licenses API endpoints
 */

import { apiClient } from "../client";
import type {
  License,
  LicenseCreate,
  LicenseUpdate,
  LicenseRenewal,
  LicenseListResponse,
  LicenseEvent,
} from "@/types/license";

export interface LicenseListFilters {
  query?: string;
  license_type?: string;
  status?: string;
  client_id?: string;
  page?: number;
  size?: number;
}

export const licensesApi = {
  /**
   * List all licenses with optional filters
   */
  async list(filters?: LicenseListFilters): Promise<LicenseListResponse> {
    const params = new URLSearchParams();

    if (filters?.query) params.append("query", filters.query);
    if (filters?.license_type) params.append("license_type", filters.license_type);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.client_id) params.append("client_id", filters.client_id);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.size) params.append("size", filters.size.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/licenses?${queryString}` : "/licenses";

    return apiClient.get<LicenseListResponse>(endpoint);
  },

  /**
   * Get a license by ID
   */
  async getById(id: string): Promise<License> {
    return apiClient.get<License>(`/licenses/${id}`);
  },

  /**
   * Create a new license
   */
  async create(data: LicenseCreate): Promise<License> {
    return apiClient.post<License>("/licenses", data);
  },

  /**
   * Update a license
   */
  async update(id: string, data: LicenseUpdate): Promise<License> {
    return apiClient.put<License>(`/licenses/${id}`, data);
  },

  /**
   * Delete a license
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/licenses/${id}`);
  },

  /**
   * Renew a license
   */
  async renew(id: string, data: LicenseRenewal): Promise<License> {
    return apiClient.post<License>(`/licenses/${id}/renew`, data);
  },

  /**
   * Get license events/history
   */
  async getEvents(id: string): Promise<LicenseEvent[]> {
    return apiClient.get<LicenseEvent[]>(`/licenses/${id}/events`);
  },

  /**
   * Check for expiring licenses
   */
  async checkExpirations(): Promise<any> {
    return apiClient.post("/licenses/check-expirations");
  },
};
