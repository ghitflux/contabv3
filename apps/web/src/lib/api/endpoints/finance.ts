/**
 * Finance API endpoints
 */

import { apiClient } from '../client';
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
} from '@/types/finance';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH_REGEX = /^\d{4}-\d{2}$/;

const normalizeDateParam = (value?: string) => {
  if (!value) return undefined;
  const datePart = value.split('T')[0];
  if (!datePart || !ISO_DATE_REGEX.test(datePart)) return undefined;
  const parsed = new Date(datePart);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return datePart;
};

const normalizeReferenceMonth = (value?: string) => {
  if (!value) return undefined;
  if (ISO_MONTH_REGEX.test(value)) {
    return `${value}-01`;
  }
  return normalizeDateParam(value);
};

const normalizePositiveInt = (value: number | undefined, fallback: number, max: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  const intValue = Math.trunc(value);
  if (intValue <= 0) return fallback;
  return Math.min(intValue, max);
};

const normalizeCurrencyNumber = (value: number): number => {
  if (!Number.isFinite(value)) return value;
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const financeApi = {
  async getTransactions(filters?: TransactionFilters): Promise<TransactionListResponse> {
    const params = new URLSearchParams();

    const clientId =
      filters?.client_id && UUID_REGEX.test(filters.client_id) ? filters.client_id : undefined;
    const status = filters?.status || undefined;
    const referenceMonth = normalizeReferenceMonth(filters?.reference_month);
    const dueDateFrom = normalizeDateParam(filters?.due_date_from);
    const dueDateTo = normalizeDateParam(filters?.due_date_to);
    const includeDeleted = Boolean(filters?.include_deleted);
    const deletedOnly = Boolean(filters?.deleted_only);

    if (clientId) params.append('client_id', clientId);
    if (status) params.append('status', status);
    if (referenceMonth) params.append('reference_month', referenceMonth);
    if (dueDateFrom) params.append('due_date_from', dueDateFrom);
    if (dueDateTo) params.append('due_date_to', dueDateTo);
    if (includeDeleted) params.append('include_deleted', 'true');
    if (deletedOnly) params.append('deleted_only', 'true');

    const size = normalizePositiveInt(filters?.size ?? 100, 100, 100);
    const page = normalizePositiveInt(filters?.page ?? 1, 1, Number.MAX_SAFE_INTEGER);
    const skip = Math.max(0, (page - 1) * size);

    params.append('skip', skip.toString());
    params.append('limit', size.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/finance?${queryString}` : '/finance';

    return apiClient.get<TransactionListResponse>(endpoint);
  },

  async getTransactionById(id: string): Promise<Transaction> {
    return apiClient.get<Transaction>(`/finance/${id}`);
  },

  async createTransaction(data: TransactionCreate): Promise<Transaction> {
    return apiClient.post<Transaction>('/finance', {
      ...data,
      amount: normalizeCurrencyNumber(data.amount),
    });
  },

  async updateTransaction(id: string, data: TransactionUpdate): Promise<Transaction> {
    return apiClient.put<Transaction>(`/finance/${id}`, {
      ...data,
      amount:
        typeof data.amount === 'number' ? normalizeCurrencyNumber(data.amount) : data.amount,
    });
  },

  async deleteTransaction(id: string): Promise<void> {
    return apiClient.delete<void>(`/finance/${id}`);
  },

  async restoreTransaction(id: string): Promise<Transaction> {
    return apiClient.post<Transaction>(`/finance/${id}/restore`);
  },

  async markAsPaid(id: string, data: TransactionMarkAsPaid): Promise<Transaction> {
    return apiClient.post<Transaction>(`/finance/${id}/pay`, data);
  },

  async cancelTransaction(id: string, data: TransactionCancel): Promise<Transaction> {
    return apiClient.post<Transaction>(`/finance/${id}/cancel`, data);
  },

  async generateMonthlyFees(data: MonthlyFeeGenerateRequest): Promise<MonthlyFeeGenerateResponse> {
    return apiClient.post<MonthlyFeeGenerateResponse>('/finance/fees/generate', data);
  },

  async previewMonthlyFees(params: { reference_month: string; client_id?: string }): Promise<any> {
    const query = new URLSearchParams();
    query.append('reference_month', params.reference_month);
    if (params.client_id) query.append('client_id', params.client_id);
    return apiClient.get(`/finance/fees/preview?${query.toString()}`);
  },

  async getDashboardKPIs(): Promise<FinancialDashboardKPIs> {
    return apiClient.get<FinancialDashboardKPIs>('/finance/reports/dashboard');
  },

  async getReceivablesAging(): Promise<ReceivablesAgingReport> {
    return apiClient.get<ReceivablesAgingReport>('/finance/reports/receivables-aging');
  },

  async getRevenueByPeriod(start_month: string, end_month: string): Promise<RevenueByPeriodReport> {
    const query = new URLSearchParams();
    query.append('start_month', start_month);
    query.append('end_month', end_month);
    return apiClient.get<RevenueByPeriodReport>(
      `/finance/reports/revenue-by-period?${query.toString()}`
    );
  },

  async getClientSummary(clientId: string): Promise<ClientFinancialSummary> {
    return apiClient.get<ClientFinancialSummary>(`/finance/reports/client/${clientId}`);
  },
};
