/**
 * Bank accounts API endpoints.
 */

import { apiClient } from "../client";
import type {
  BankAccount,
  BankAccountCreate,
  BankAccountListResponse,
  BankAccountUpdate,
} from "@/types/bank-account";

export const bankAccountsApi = {
  async list(params?: { client_id?: string; office_only?: boolean; skip?: number; limit?: number }): Promise<BankAccountListResponse> {
    const query = new URLSearchParams();
    if (params?.client_id) query.append("client_id", params.client_id);
    if (params?.office_only) query.append("office_only", "true");
    if (typeof params?.skip === "number") query.append("skip", String(params.skip));
    if (typeof params?.limit === "number") query.append("limit", String(params.limit));
    const qs = query.toString();
    return apiClient.get<BankAccountListResponse>(`/bank-accounts${qs ? `?${qs}` : ""}`);
  },

  async create(data: BankAccountCreate): Promise<BankAccount> {
    return apiClient.post<BankAccount>("/bank-accounts", data);
  },

  async update(id: string, data: BankAccountUpdate): Promise<BankAccount> {
    return apiClient.put<BankAccount>(`/bank-accounts/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/bank-accounts/${id}`);
  },
};
