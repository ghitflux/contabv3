/**
 * Financial transaction types - TypeScript interfaces for frontend
 */

// Enums
export enum TransactionType {
  RECEITA = 'receita',
  DESPESA = 'despesa',
}

export enum PaymentMethod {
  PIX = 'pix',
  BOLETO = 'boleto',
  TRANSFERENCIA = 'transferencia',
  DINHEIRO = 'dinheiro',
  CARTAO_CREDITO = 'cartao_credito',
  CARTAO_DEBITO = 'cartao_debito',
  CHEQUE = 'cheque',
}

export enum PaymentStatus {
  PENDENTE = 'pendente',
  PAGO = 'pago',
  ATRASADO = 'atrasado',
  CANCELADO = 'cancelado',
  PARCIAL = 'parcial',
}

export const DISTRIBUTION_PROFITS_CATEGORY = 'distribuicao_lucros';

export const DUE_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PENDENTE,
  PaymentStatus.ATRASADO,
  PaymentStatus.PARCIAL,
];

export function isDuePaymentStatus(status: PaymentStatus): boolean {
  return DUE_PAYMENT_STATUSES.includes(status);
}

export function isProfitDistributionTransaction(transaction: Pick<Transaction, 'category'>): boolean {
  return (transaction.category ?? '').trim().toLowerCase() === DISTRIBUTION_PROFITS_CATEGORY;
}

export function extractBankNameFromNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/(?:^|\|\s*)Banco:\s*([^|]+)/i);
  return match?.[1]?.trim() || null;
}

// Main transaction interface
export interface Transaction {
  id: string;
  client_id: string;
  client_name?: string;
  client_cnpj?: string;
  obligation_id?: string | null;
  transaction_type: TransactionType;
  amount: number;
  payment_method?: PaymentMethod | null;
  payment_status: PaymentStatus;
  due_date: string; // ISO date string
  paid_date?: string | null; // ISO datetime string
  reference_month: string; // ISO date string (first day of month)
  description: string;
  category?: string | null; // Código do plano de contas (ex: "1.1.01", "2.1.05")
  notes?: string | null;
  invoice_number?: string | null;
  receipt_url?: string | null;
  recurring_template_id?: string | null;
  restore_blocked_reason?: string | null;
  created_by_id: string;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
  deleted_at?: string | null; // ISO datetime string
}

// Create/Update interfaces
export interface TransactionCreate {
  client_id: string;
  obligation_id?: string | null;
  transaction_type?: TransactionType;
  amount: number;
  payment_method?: PaymentMethod | null;
  payment_status?: PaymentStatus;
  due_date: string; // ISO date string
  paid_date?: string | null;
  reference_month: string; // ISO date string
  description: string;
  category?: string | null; // Código do plano de contas
  notes?: string | null;
  invoice_number?: string | null;
  is_recurring?: boolean;
  recurring_day?: number | null;
}

export interface TransactionUpdate {
  amount?: number;
  payment_method?: PaymentMethod | null;
  payment_status?: PaymentStatus;
  due_date?: string;
  paid_date?: string | null;
  description?: string;
  category?: string | null; // Código do plano de contas
  notes?: string | null;
  invoice_number?: string | null;
}

export interface TransactionMarkAsPaid {
  paid_date: string; // ISO datetime string
  payment_method: PaymentMethod;
  notes?: string | null;
}

export interface TransactionCancel {
  reason: string;
}

// List response
export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  skip: number;
  limit: number;
}

// Filters
export interface TransactionFilters {
  client_id?: string;
  status?: PaymentStatus | '';
  payment_method?: PaymentMethod | '';
  reference_month?: string; // YYYY-MM format
  due_date_from?: string;
  due_date_to?: string;
  include_deleted?: boolean;
  deleted_only?: boolean;
  page?: number;
  size?: number;
}

// Fee generation
export interface MonthlyFeeGenerateRequest {
  reference_month: string; // ISO date string (first day of month)
  client_id?: string | null;
  client_ids?: string[];
}

export interface MonthlyFeeGenerateResponse {
  success: boolean;
  total_clients: number;
  total_transactions: number;
  reference_month?: string | null;
  created_client_entries?: number | null;
  created_office_entries?: number | null;
  skipped?: number | null;
  errors: number;
  message: string;
}

export interface MonthlyFeePreviewClient {
  client_id: string;
  client_name: string;
  client_cnpj?: string | null;
  amount: number;
  due_date?: string | null;
  would_create_client_entry: boolean;
  would_create_office_entry: boolean;
  existing_client_entry: boolean;
  existing_office_entry: boolean;
  blocked: boolean;
  blocked_reason?: string | null;
}

export interface MonthlyFeePreviewResponse {
  total_clients: number;
  would_generate_count: number;
  would_generate_entries: number;
  total_amount: number;
  reference_month: string;
  blocked_count: number;
  has_more: boolean;
  clients: MonthlyFeePreviewClient[];
}

export interface TransactionBulkIdsRequest {
  transaction_ids: string[];
}

export interface TransactionBulkPayRequest extends TransactionBulkIdsRequest {
  paid_date?: string | null;
  payment_method?: PaymentMethod;
  notes?: string | null;
}

export interface TransactionBulkOperationItem {
  transaction_id: string;
  success: boolean;
  detail?: string | null;
}

export interface TransactionBulkOperationResponse {
  success: boolean;
  action: string;
  requested: number;
  processed: number;
  succeeded: number;
  failed: number;
  items: TransactionBulkOperationItem[];
}

export interface TransactionTrashPurgeResponse {
  success: boolean;
  deleted: number;
}

export interface MonthlyFeeBulkDeleteRequest {
  office_transaction_ids: string[];
  reason?: string | null;
}

export interface MonthlyFeeBulkDeleteItem {
  office_transaction_id: string;
  client_id?: string | null;
  reference_month?: string | null;
  success: boolean;
  deleted_office_entry: boolean;
  deleted_client_entry: boolean;
  blocked: boolean;
  detail?: string | null;
}

export interface MonthlyFeeBulkDeleteResponse {
  success: boolean;
  requested: number;
  succeeded: number;
  failed: number;
  blocked_competences: number;
  items: MonthlyFeeBulkDeleteItem[];
}

export interface MonthlyFeePairUpdate {
  amount?: number;
  due_date?: string;
  payment_method?: PaymentMethod | null;
  paid_date?: string | null;
  notes?: string | null;
  invoice_number?: string | null;
}

export interface MonthlyFeePairOperationResponse {
  success: boolean;
  client_id: string;
  reference_month: string;
  office_transaction: Transaction;
  client_transaction?: Transaction | null;
  blocked_competence: boolean;
  detail?: string | null;
}

// Financial KPIs
export interface FinancialDashboardKPIs {
  // Revenue
  total_receita_mes_atual: number;
  total_receita_mes_anterior: number;
  receita_crescimento_percentual: number;

  // Receivables
  total_pendente: number;
  total_atrasado: number;
  total_pago_mes_atual: number;

  // Counts
  count_pendente: number;
  count_atrasado: number;
  count_pago_mes_atual: number;

  // Top clients
  top_devedores: Array<{
    client_id: string;
    client_name: string;
    total_pendente: number;
  }>;
}

// Reports
export interface AgingBucket {
  label: string;
  count: number;
  total_amount: number;
}

export interface ReceivablesAgingReport {
  current: AgingBucket;
  days_0_30: AgingBucket;
  days_31_60: AgingBucket;
  days_61_90: AgingBucket;
  days_over_90: AgingBucket;
  total: number;
  total_count: number;
}

export interface PeriodRevenue {
  period: string; // YYYY-MM format
  receita: number;
  despesa: number;
  saldo: number;
}

export interface RevenueByPeriodReport {
  periods: PeriodRevenue[];
  total_receita: number;
  total_despesa: number;
  total_saldo: number;
}

export interface ClientFinancialSummary {
  client_id: string;
  client_name: string;
  client_cnpj: string;
  total_pendente: number;
  total_atrasado: number;
  total_pago: number;
  ultimo_pagamento?: string | null; // ISO datetime string
  proxima_vencimento?: string | null; // ISO date string
  transactions: Transaction[];
}

// Helper functions
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

export function getPaymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    [PaymentStatus.PENDENTE]: 'Pendente',
    [PaymentStatus.PAGO]: 'Pago',
    [PaymentStatus.ATRASADO]: 'Atrasado',
    [PaymentStatus.CANCELADO]: 'Cancelado',
    [PaymentStatus.PARCIAL]: 'Parcial',
  };
  return labels[status];
}

export function getPaymentStatusColor(
  status: PaymentStatus
): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
  const colors: Record<PaymentStatus, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
    [PaymentStatus.PENDENTE]: 'warning',
    [PaymentStatus.PAGO]: 'success',
    [PaymentStatus.ATRASADO]: 'danger',
    [PaymentStatus.CANCELADO]: 'default',
    [PaymentStatus.PARCIAL]: 'primary',
  };
  return colors[status];
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    [PaymentMethod.PIX]: 'PIX',
    [PaymentMethod.BOLETO]: 'Boleto',
    [PaymentMethod.TRANSFERENCIA]: 'Transferência',
    [PaymentMethod.DINHEIRO]: 'Dinheiro',
    [PaymentMethod.CARTAO_CREDITO]: 'Cartão de Crédito',
    [PaymentMethod.CARTAO_DEBITO]: 'Cartão de Débito',
    [PaymentMethod.CHEQUE]: 'Cheque',
  };
  return labels[method];
}

const AUTO_FEE_MARKER = 'honorários recorrentes';
const CLIENT_AUTO_FEE_DESCRIPTION_REGEX = /^Honorários do escritório - \d{2}\/\d{4}$/;
const OFFICE_AUTO_FEE_DESCRIPTION_REGEX = /^Honorários - .+ \([^)]+\) - \d{2}\/\d{4}$/;
const AUTO_FEE_CLIENT_ID_REGEX =
  /Cliente:\s*[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function hasAutomaticFeeMarker(notes?: string | null): boolean {
  return Boolean(notes && notes.toLowerCase().includes(AUTO_FEE_MARKER));
}

export function isAutomaticClientMonthlyFeeTransaction(
  transaction: Pick<Transaction, 'transaction_type' | 'description' | 'notes'>
): boolean {
  return (
    transaction.transaction_type === TransactionType.DESPESA &&
    CLIENT_AUTO_FEE_DESCRIPTION_REGEX.test(transaction.description || '') &&
    hasAutomaticFeeMarker(transaction.notes)
  );
}

export function isAutomaticOfficeMonthlyFeeTransaction(
  transaction: Pick<Transaction, 'client_id' | 'transaction_type' | 'description' | 'notes'>,
  officeClientId?: string | null
): boolean {
  return Boolean(
    officeClientId &&
      transaction.client_id === officeClientId &&
      transaction.transaction_type === TransactionType.RECEITA &&
      OFFICE_AUTO_FEE_DESCRIPTION_REGEX.test(transaction.description || '') &&
      hasAutomaticFeeMarker(transaction.notes) &&
      AUTO_FEE_CLIENT_ID_REGEX.test(transaction.notes || '')
  );
}

export function isAutomaticMonthlyFeeTransaction(
  transaction: Pick<Transaction, 'client_id' | 'transaction_type' | 'description' | 'notes'>,
  officeClientId?: string | null
): boolean {
  return (
    isAutomaticClientMonthlyFeeTransaction(transaction) ||
    isAutomaticOfficeMonthlyFeeTransaction(transaction, officeClientId)
  );
}
