/**
 * Report types - TypeScript interfaces for frontend
 */

// Enums
export enum ReportType {
  // Strategic reports
  GERAL = 'geral',

  // Financial reports
  DRE = 'dre',
  FLUXO_CAIXA = 'fluxo_caixa',
  LIVRO_CAIXA = 'livro_caixa',
  RECEITAS_CLIENTE = 'receitas_cliente',
  DESPESAS_CATEGORIA = 'despesas_categoria',
  PROJECAO_FLUXO = 'projecao_fluxo',
  KPIS = 'kpis',

  // Operational reports
  CLIENTES = 'clientes',
  OBRIGACOES = 'obrigacoes',
  LICENCAS = 'licencas',
  AUDITORIA = 'auditoria',
}

export enum ReportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  XLS = 'xls',
}

export enum ReportStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  PIE = 'pie',
  DONUT = 'donut',
  AREA = 'area',
  TABLE = 'table',
}

// Request interfaces
export interface ReportFilterRequest {
  period_start: string; // ISO date string
  period_end: string; // ISO date string
  client_ids?: string[] | null;
  status?: string | null;
  statuses?: string[] | null;
  report_type: ReportType;
}

export interface ReportCustomization {
  fields_to_include?: string[] | null;
  group_by?: string | null;
  sort_by?: string | null;
  sort_direction?: 'asc' | 'desc';
  chart_types?: ChartType[] | null;
  include_summary?: boolean;
  include_charts?: boolean;
}

export interface ReportPreviewRequest {
  report_type: ReportType;
  filters: ReportFilterRequest;
  customizations?: ReportCustomization | null;
}

export interface ReportExportRequest {
  report_type: ReportType;
  format: ReportFormat;
  filters: ReportFilterRequest;
  customizations?: ReportCustomization | null;
  filename?: string | null;
  save_as_template?: boolean;
}

// Response interfaces
export interface ReportPreviewResponse {
  report_type: ReportType;
  data: Record<string, any>;
  charts_config?: Array<Record<string, any>> | null;
  summary?: Record<string, any> | null;
  generated_at: string; // ISO datetime string
  record_count: number;
}

export interface ReportExportResponse {
  report_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  format: ReportFormat;
  generated_at: string; // ISO datetime string
  expires_at: string; // ISO datetime string
}

export interface ChartConfig {
  type: ChartType;
  title: string;
  data_key: string;
  x_axis_key?: string | null;
  y_axis_key?: string | null;
  color_scheme?: string[] | null;
}

// Template interfaces
export interface ReportTemplateCreate {
  name: string;
  description?: string | null;
  report_type: ReportType;
  default_filters: Record<string, any>;
  default_customizations?: Record<string, any> | null;
}

export interface ReportTemplateUpdate {
  name?: string;
  description?: string;
  default_filters?: Record<string, any>;
  default_customizations?: Record<string, any>;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string | null;
  report_type: ReportType;
  default_filters: Record<string, any>;
  default_customizations?: Record<string, any> | null;
  is_system: boolean;
  created_by_id: string;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

// History interfaces
export interface ReportHistory {
  id: string;
  template_id?: string | null;
  user_id: string;
  report_type: ReportType;
  filters_used: Record<string, any>;
  format: ReportFormat;
  file_path?: string | null;
  file_size?: number | null;
  generated_at: string; // ISO datetime string
  deleted_at?: string | null; // ISO datetime string
  expires_at?: string | null; // ISO datetime string
  status: ReportStatus;
}

export interface ReportHistoryListResponse {
  items: ReportHistory[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Report type info
export interface ReportTypeInfo {
  type: ReportType;
  name: string;
  description: string;
  category: 'financeiro' | 'operacional';
  supports_customization: boolean;
  supported_charts: ChartType[];
  required_permissions?: string[] | null;
}

export interface ReportTypesListResponse {
  types: ReportTypeInfo[];
}

// Financial report data structures
export interface DRERow {
  categoria: string;
  valor: number;
  percentual?: number | null;
}

export interface DREReportData {
  receitas: DRERow[];
  despesas: DRERow[];
  receita_total: number;
  despesa_total: number;
  resultado_liquido: number;
  margem_lucro: number;
}

export interface CashFlowPeriod {
  periodo: string; // YYYY-MM
  entradas: number;
  saidas: number;
  saldo_inicial: number;
  saldo_final: number;
}

export interface CashFlowReportData {
  periods: CashFlowPeriod[];
  total_entradas: number;
  total_saidas: number;
  saldo_final_periodo: number;
}

export interface CashBookEntry {
  data: string; // ISO date string
  tipo: 'entrada' | 'saida';
  descricao: string;
  valor: number;
  saldo_acumulado: number;
}

export interface CashBookReportData {
  entries: CashBookEntry[];
  saldo_inicial: number;
  saldo_final: number;
  total_entradas: number;
  total_saidas: number;
}

export interface ClientRevenue {
  client_id: string;
  client_name: string;
  client_cnpj?: string | null;
  total_receita: number;
  percentual_total: number;
}

export interface RevenueByClientReportData {
  clients: ClientRevenue[];
  total_receita: number;
}

export interface CategoryExpense {
  categoria: string;
  total: number;
  percentual_total: number;
}

export interface ExpensesByCategoryReportData {
  categories: CategoryExpense[];
  total_despesas: number;
}

export interface ProjectionPeriod {
  periodo: string; // YYYY-MM
  cenario_otimista: number;
  cenario_realista: number;
  cenario_pessimista: number;
}

export interface CashFlowProjectionReportData {
  periods: ProjectionPeriod[];
  metodo_projecao: string;
  base_historico_meses: number;
}

export interface KPIReportData {
  receita_total?: number;
  despesa_total?: number;
  resultado_liquido?: number;
  total_pendente?: number;
  total_atrasado?: number;
  total_receber?: number;
  total_clientes?: number;
  total_transacoes?: number;
  total_transacoes_atrasadas?: number;
  margem_lucro: number;
  percentual_despesas_fixas: number;
  taxa_inadimplencia: number;
  ticket_medio: number;
  crescimento_mom: number;
  crescimento_yoy: number;
  roi?: number | null;
}

export interface GeneralReportCompany {
  escopo: 'escritorio' | 'cliente' | 'consolidado';
  id?: string | null;
  nome: string;
  razao_social?: string | null;
  cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
}

export interface GeneralMonthlyEvolution {
  competencia: string;
  receita_total: number;
  despesa_total: number;
  resultado_liquido: number;
  margem_lucro: number;
}

export interface GeneralProjectionPeriod {
  competencia: string;
  previsao_receita: number;
  previsao_despesa: number;
  previsao_resultado: number;
}

export interface GeneralReportData {
  empresa: GeneralReportCompany;
  resumo_financeiro: {
    receita_total: number;
    despesa_total: number;
    resultado_liquido: number;
    margem_lucro: number;
  };
  dre_simplificada: DREReportData;
  kpis: {
    margem_operacional: number;
    resultado_liquido: number;
    receita_total: number;
    despesa_total: number;
  };
  evolucao_mensal: GeneralMonthlyEvolution[];
  analises: {
    principais_receitas: DRERow[];
    principais_despesas: DRERow[];
  };
  projecoes: {
    metodo_projecao: string;
    base_historico_meses: number;
    periodos: GeneralProjectionPeriod[];
  };
}

// Operational report data structures
export interface ClientInfo {
  id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj: string;
  email?: string | null;
  status: string;
  regime_tributario: string;
  honorarios: number;
  total_pendente: number;
  total_atrasado: number;
}

export interface ClientsReportData {
  clients: ClientInfo[];
  total_clientes: number;
  total_clientes_ativos: number;
  total_honorarios: number;
  por_regime: Array<{ regime: string; total: number }>;
  por_status: Array<{ status: string; total: number }>;
}

export interface ObligationReportItem {
  id: string;
  client_id: string;
  client_name: string;
  client_razao_social: string;
  client_cnpj: string;
  obligation_name: string;
  obligation_code: string;
  status: string;
  competencia: string;
  due_date: string;
  priority: string;
  completed_at?: string | null;
}

export interface ObligationsReportData {
  compliance_rate: number;
  total_obligations: number;
  pending: number;
  completed: number;
  overdue: number;
  cancelled: number;
  totais_por_status: Array<{ status: string; total: number }>;
  obligations: ObligationReportItem[];
}

export interface LicensesReportData {
  total_licenses: number;
  active: number;
  expiring_soon: number;
  expired: number;
  renewals_in_period: number;
}

export interface AuditReportData {
  total_actions: number;
  actions_by_user: Record<string, number>;
  actions_by_module: Record<string, number>;
  actions_by_type: Record<string, number>;
}

// Helper functions
export function getReportTypeLabel(type: ReportType): string {
  const labels: Record<ReportType, string> = {
    [ReportType.GERAL]: 'Relatório Geral',
    [ReportType.DRE]: 'Demonstrativo de Resultados (DRE)',
    [ReportType.FLUXO_CAIXA]: 'Fluxo de Caixa',
    [ReportType.LIVRO_CAIXA]: 'Livro Caixa',
    [ReportType.RECEITAS_CLIENTE]: 'Receitas por Cliente',
    [ReportType.DESPESAS_CATEGORIA]: 'Despesas por Categoria',
    [ReportType.PROJECAO_FLUXO]: 'Projeção de Fluxo de Caixa',
    [ReportType.KPIS]: 'Indicadores Financeiros (KPIs)',
    [ReportType.CLIENTES]: 'Relatório de Clientes',
    [ReportType.OBRIGACOES]: 'Relatório de Obrigações',
    [ReportType.LICENCAS]: 'Relatório de Licenças',
    [ReportType.AUDITORIA]: 'Relatório de Auditoria',
  };
  return labels[type];
}

export function getReportTypeCategory(type: ReportType): 'financeiro' | 'operacional' {
  const financialTypes = [
    ReportType.GERAL,
    ReportType.DRE,
    ReportType.FLUXO_CAIXA,
    ReportType.LIVRO_CAIXA,
    ReportType.RECEITAS_CLIENTE,
    ReportType.DESPESAS_CATEGORIA,
    ReportType.PROJECAO_FLUXO,
    ReportType.KPIS,
  ];
  return financialTypes.includes(type) ? 'financeiro' : 'operacional';
}

export function getReportFormatLabel(format: ReportFormat): string {
  const labels: Record<ReportFormat, string> = {
    [ReportFormat.PDF]: 'PDF',
    [ReportFormat.CSV]: 'CSV',
    [ReportFormat.XLS]: 'XLS',
  };
  return labels[format];
}

export function getReportStatusLabel(status: ReportStatus): string {
  const labels: Record<ReportStatus, string> = {
    [ReportStatus.PENDING]: 'Gerando',
    [ReportStatus.COMPLETED]: 'Concluído',
    [ReportStatus.FAILED]: 'Falhou',
  };
  return labels[status];
}

export function getReportStatusColor(
  status: ReportStatus
): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
  const colors: Record<ReportStatus, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
    [ReportStatus.PENDING]: 'primary',
    [ReportStatus.COMPLETED]: 'success',
    [ReportStatus.FAILED]: 'danger',
  };
  return colors[status];
}
