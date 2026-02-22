/**
 * Licenses API client using native fetch under the hood (via apiClient).
 */

import { apiClient } from "./client";
import type { License, LicenseListResponse } from "@/types/license";

const API_PREFIX = "/licenses";

function toQuery(params: Record<string, unknown> = {}): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || Number.isNaN(value)) {
      return;
    }
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function apiGet<T>(path: string): Promise<T> {
  return apiClient.get<T>(path);
}

async function apiPost<T>(path: string, body?: any): Promise<T> {
  return apiClient.post<T>(path, body);
}

async function apiPut<T>(path: string, body?: any): Promise<T> {
  return apiClient.put<T>(path, body);
}

export const licensesApi = {
  list: (params?: Record<string, unknown>) =>
    apiGet<LicenseListResponse>(`${API_PREFIX}${toQuery(params ?? {})}`),

  summary: (params?: { client_id?: string }) =>
    apiGet<{
      active: number;
      expired: number;
      renewing: number;
      pending: number;
      cancelled: number;
      unpaid_fees: number;
    }>(`${API_PREFIX}/summary${toQuery(params ?? {})}`),

  summaryByType: () =>
    apiGet<Record<string, number>>(`${API_PREFIX}/summary-by-type`),

  create: (payload: Partial<License>) => apiPost<License>(`${API_PREFIX}`, payload),

  update: (id: string, payload: any) => apiPut<License>(`${API_PREFIX}/${id}`, payload),

  renew: (id: string, payload: any) =>
    apiPost<License>(`${API_PREFIX}/${id}/renew`, payload),

  delete: (id: string) => apiClient.delete(`${API_PREFIX}/${id}`),

  restore: (id: string) => apiPost<License>(`${API_PREFIX}/${id}/restore`),

  get: (id: string) => apiGet<License>(`${API_PREFIX}/${id}`),

  getById: (id: string) => apiGet<License>(`${API_PREFIX}/${id}`),

  getEvents: (id: string) => apiGet<any[]>(`${API_PREFIX}/${id}/events`),

  uploadDocument: async (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.upload(`${API_PREFIX}/${id}/documents`, form);
  },
};
