/**
 * Obligations API endpoints
 */

import { apiClient } from "../client";
import type { ClientMatrixRow } from "@/hooks/useObligationsMatrix";

export interface ObligationResponse {
  id: string;
  client_id: string;
  client_name: string;
  client_cnpj: string;
  obligation_type_id: string;
  obligation_type_name: string;
  obligation_type_code: string;
  due_date: string;
  status: string;
  priority: string;
  description?: string;
  receipt_url?: string;
  completed_at?: string;
  completed_by_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface ObligationListResponse {
  items: ObligationResponse[];
  total: number;
  skip: number;
  limit: number;
}

export interface ObligationListFilters {
  client_id?: string;
  status?: "pendente" | "em_andamento" | "concluida" | "atrasada" | "cancelada";
  year?: number;
  month?: number;
  category?: "clients" | "office";
  include_deleted?: boolean;
  deleted_only?: boolean;
  page?: number;
  size?: number;
}

export interface ObligationCreateRequest {
  client_id: string;
  obligation_type_id: string;
  due_date: string;
  priority?: "baixa" | "media" | "alta" | "urgente";
  description?: string | null;
}

export interface ObligationUpdateRequest {
  status?: "pendente" | "em_andamento" | "concluida" | "atrasada" | "cancelada";
  priority?: "baixa" | "media" | "alta" | "urgente";
  description?: string | null;
  due_date?: string;
}

export interface ObligationTypeResponse {
  id: string;
  name: string;
  code: string;
  description?: string;
  applies_to_commerce: boolean;
  applies_to_service: boolean;
  applies_to_industry: boolean;
  applies_to_mei: boolean;
  applies_to_simples: boolean;
  applies_to_presumido: boolean;
  applies_to_real: boolean;
  recurrence: string;
  day_of_month?: number;
  month_of_year?: number;
  is_active: boolean;
}

export interface ObligationAlertsResponse {
  items: ObligationResponse[];
  total: number;
  start_date: string;
  end_date: string;
}

export const obligationsApi = {
  async getObligations(filters?: ObligationListFilters): Promise<ObligationListResponse> {
    const params = new URLSearchParams();

    if (filters?.client_id) params.append("client_id", filters.client_id);
    if (filters?.status) params.append("status", filters.status);
    if (typeof filters?.year === "number") params.append("year", String(filters.year));
    if (typeof filters?.month === "number") params.append("month", String(filters.month));
    if (filters?.category) params.append("category", filters.category);
    if (filters?.include_deleted) params.append("include_deleted", "true");
    if (filters?.deleted_only) params.append("deleted_only", "true");

    const size = Math.max(1, Math.min(200, Math.trunc(filters?.size ?? 100)));
    const page = Math.max(1, Math.trunc(filters?.page ?? 1));
    params.append("skip", String((page - 1) * size));
    params.append("limit", String(size));

    const query = params.toString();
    return apiClient.get<ObligationListResponse>(query ? `/obligations?${query}` : "/obligations");
  },

  /**
   * Get all obligation types (for selecting which obligations to generate)
   */
  async getObligationTypes(isActive?: boolean): Promise<ObligationTypeResponse[]> {
    const params = new URLSearchParams();
    if (isActive !== undefined) {
      params.append("is_active", isActive.toString());
    }
    return apiClient.get<ObligationTypeResponse[]>(`/obligations/types${params.toString() ? `?${params}` : ''}`);
  },

  /**
   * Get obligations matrix for minimalist panel
   */
  async getMatrix(params: {
    month: number;
    year: number;
    search?: string;
    starts_with?: string;
    category?: "clients" | "office";
    due_date_from?: string;
    due_date_to?: string;
  }): Promise<ClientMatrixRow[]> {
    const query = new URLSearchParams({
      month: params.month.toString(),
      year: params.year.toString(),
    });

    if (params.search) {
      query.append("search", params.search);
    }
    if (params.starts_with) {
      query.append("starts_with", params.starts_with);
    }
    if (params.category) {
      query.append("category", params.category);
    }
    if (params.due_date_from) {
      query.append("due_date_from", params.due_date_from);
    }
    if (params.due_date_to) {
      query.append("due_date_to", params.due_date_to);
    }

    return apiClient.get<ClientMatrixRow[]>(`/obligations/matrix?${query}`);
  },

  async getObligationById(obligationId: string): Promise<ObligationResponse> {
    return apiClient.get<ObligationResponse>(`/obligations/${obligationId}`);
  },

  async createObligation(data: ObligationCreateRequest): Promise<ObligationResponse> {
    return apiClient.post<ObligationResponse>("/obligations", data);
  },

  async updateObligation(
    obligationId: string,
    data: ObligationUpdateRequest
  ): Promise<ObligationResponse> {
    return apiClient.put<ObligationResponse>(`/obligations/${obligationId}`, data);
  },

  async deleteObligation(obligationId: string): Promise<void> {
    return apiClient.delete<void>(`/obligations/${obligationId}`);
  },

  async restoreObligation(obligationId: string): Promise<ObligationResponse> {
    return apiClient.post<ObligationResponse>(`/obligations/${obligationId}/restore`, {});
  },

  /**
   * Mark obligation as completed
   */
  async complete(obligationId: string): Promise<ObligationResponse> {
    return apiClient.post<ObligationResponse>(`/obligations/${obligationId}/complete`, {});
  },

  /**
   * Undo obligation completion
   */
  async undo(obligationId: string): Promise<ObligationResponse> {
    return apiClient.post<ObligationResponse>(`/obligations/${obligationId}/undo`, {});
  },

  /**
   * Upload receipt and mark obligation as completed
   */
  async uploadReceipt(obligationId: string, file: File, notes?: string): Promise<ObligationResponse> {
    const formData = new FormData();
    formData.append("file", file);
    if (notes) {
      formData.append("notes", notes);
    }

    return apiClient.upload<ObligationResponse>(`/obligations/${obligationId}/receipt`, formData);
  },

  /**
   * Get pending obligations within a due date range (for alerts/popups)
   */
  async getAlerts(params: { start_date: string; end_date: string }): Promise<ObligationAlertsResponse> {
    const query = new URLSearchParams();
    query.append("start_date", params.start_date);
    query.append("end_date", params.end_date);
    return apiClient.get<ObligationAlertsResponse>(`/obligations/alerts?${query.toString()}`);
  },
};
