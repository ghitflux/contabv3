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
  async getMatrix(month: number, year: number, search?: string): Promise<ClientMatrixRow[]> {
    const params = new URLSearchParams({
      month: month.toString(),
      year: year.toString(),
    });

    if (search) {
      params.append("search", search);
    }

    return apiClient.get<ClientMatrixRow[]>(`/obligations/matrix?${params}`);
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
