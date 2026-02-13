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
}

export interface MonthlyFeeGenerateResponse {
  success: boolean;
  total_clients: number;
  total_transactions: number;
  errors: number;
  message: string;
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
