/**
 * Finance API endpoints
 */

import { apiClient } from "../client";
import type {
  Transaction,
  TransactionCreate,
  TransactionUpdate,
  TransactionListResponse,
  TransactionFilters,
  TransactionMarkAsPaid,
  TransactionCancel,
  MonthlyFeeGenerateRequest,
  MonthlyFeeGenerateResponse,
  FinancialDashboardKPIs,
  ReceivablesAgingReport,
  RevenueByPeriodReport,
  ClientFinancialSummary,
} from "@/types/finance";

export const financeApi = {
  async getTransactions(filters?: TransactionFilters): Promise<TransactionListResponse> {
    const params = new URLSearchParams();

    if (filters?.client_id) params.append("client_id", filters.client_id);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.reference_month) params.append("reference_month", filters.reference_month);
    if (filters?.due_date_from) params.append("due_date_from", filters.due_date_from);
    if (filters?.due_date_to) params.append("due_date_to", filters.due_date_to);

    const size = filters?.size ?? 100;
    const page = filters?.page ?? 1;
    const skip = Math.max(0, (page - 1) * size);

    params.append("skip", skip.toString());
    params.append("limit", size.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/finance?${queryString}` : "/finance";

    return apiClient.get<TransactionListResponse>(endpoint);
  },

  async getTransactionById(id: string): Promise<Transaction> {
    return apiClient.get<Transaction>(`/finance/${id}`);
  },

  async createTransaction(data: TransactionCreate): Promise<Transaction> {
    return apiClient.post<Transaction>("/finance", data);
  },

  async updateTransaction(id: string, data: TransactionUpdate): Promise<Transaction> {
    return apiClient.put<Transaction>(`/finance/${id}`, data);
  },

  async deleteTransaction(id: string): Promise<void> {
    return apiClient.delete<void>(`/finance/${id}`);
  },

  async markAsPaid(id: string, data: TransactionMarkAsPaid): Promise<Transaction> {
    return apiClient.post<Transaction>(`/finance/${id}/pay`, data);
  },

  async cancelTransaction(id: string, data: TransactionCancel): Promise<Transaction> {
    return apiClient.post<Transaction>(`/finance/${id}/cancel`, data);
  },

  async generateMonthlyFees(data: MonthlyFeeGenerateRequest): Promise<MonthlyFeeGenerateResponse> {
    return apiClient.post<MonthlyFeeGenerateResponse>("/finance/fees/generate", data);
  },

  async previewMonthlyFees(params: { reference_month: string; client_id?: string }): Promise<any> {
    const query = new URLSearchParams();
    query.append("reference_month", params.reference_month);
    if (params.client_id) query.append("client_id", params.client_id);
    return apiClient.get(`/finance/fees/preview?${query.toString()}`);
  },

  async getDashboardKPIs(): Promise<FinancialDashboardKPIs> {
    return apiClient.get<FinancialDashboardKPIs>("/finance/reports/dashboard");
  },

  async getReceivablesAging(): Promise<ReceivablesAgingReport> {
    return apiClient.get<ReceivablesAgingReport>("/finance/reports/receivables-aging");
  },

  async getRevenueByPeriod(start_month: string, end_month: string): Promise<RevenueByPeriodReport> {
    const query = new URLSearchParams();
    query.append("start_month", start_month);
    query.append("end_month", end_month);
    return apiClient.get<RevenueByPeriodReport>(`/finance/reports/revenue-by-period?${query.toString()}`);
  },

  async getClientSummary(clientId: string): Promise<ClientFinancialSummary> {
    return apiClient.get<ClientFinancialSummary>(`/finance/reports/client/${clientId}`);
  },
};
