/**
 * Clients API endpoints
 */

import { apiClient } from "../client";
import type {
  Client,
  ClientCreate,
  ClientUpdate,
  ClientListResponse,
  ClientFilters,
  ClientCreateResult,
} from "@/types/client";

export const clientsApi = {
  /**
   * List all clients with optional filters
   */
  async list(filters?: ClientFilters): Promise<ClientListResponse> {
    const params = new URLSearchParams();

    if (filters?.query) params.append("query", filters.query);
    if (filters?.status && filters.status !== "" as any) params.append("status", filters.status);
    if (filters?.regime_tributario && filters.regime_tributario !== "" as any) {
      params.append("regime_tributario", filters.regime_tributario);
    }
    if (filters?.tipo_empresa && filters.tipo_empresa !== "" as any) {
      params.append("tipo_empresa", filters.tipo_empresa);
    }
    if (filters?.starts_with) params.append("starts_with", filters.starts_with);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.size) params.append("size", filters.size.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/clients?${queryString}` : "/clients";

    return apiClient.get<ClientListResponse>(endpoint);
  },

  /**
   * Get a client by ID
   */
  async getById(id: string): Promise<Client> {
    return apiClient.get<Client>(`/clients/${id}`);
  },

  /**
   * Create a new client
   */
  async create(data: ClientCreate): Promise<ClientCreateResult> {
    return apiClient.post<ClientCreateResult>("/clients", data);
  },

  /**
   * Update a client
   */
  async update(id: string, data: ClientUpdate): Promise<Client> {
    return apiClient.put<Client>(`/clients/${id}`, data);
  },

  /**
   * Delete a client
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/clients/${id}`);
  },

  /**
   * Get current authenticated client data
   */
  async getMe(): Promise<Client> {
    return apiClient.get<Client>("/clients/me");
  },
};
