/**
 * Client types and interfaces.
 */

export enum ClientStatus {
  ATIVO = 'ativo',
  INATIVO = 'inativo',
  PENDENTE = 'pendente',
}

export enum RegimeTributario {
  SIMPLES_NACIONAL = 'simples_nacional',
  LUCRO_PRESUMIDO = 'lucro_presumido',
  LUCRO_REAL = 'lucro_real',
  MEI = 'mei',
}

export enum TipoEmpresa {
  COMERCIO = 'comercio',
  SERVICO = 'servico',
  INDUSTRIA = 'industria',
  FINANCEIRO = 'financeiro',
}

export enum ServicoContratado {
  FISCAL = 'fiscal',
  CONTABIL = 'contabil',
  PESSOAL = 'pessoal',
}

export enum LicencaNecessaria {
  LICENCA_SANITARIA = 'licenca_sanitaria',
  ARCB_BOMBEIROS = 'arcb_bombeiros',
  ALVARA_FUNCIONAMENTO = 'alvara_funcionamento',
  LICENCA_OPERACOES = 'licenca_operacoes',
  BAIXO_RISCO = 'baixo_risco',
  CERT_ACESSIBILIDADE = 'cert_acessibilidade',
}

export interface ClientBase {
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;

  // Contact
  email: string;
  telefone: string | null;
  celular: string | null;

  // Address
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;

  // Financial
  honorarios_mensais: number;
  dia_vencimento: number;
  gerar_lancamentos_honorarios: boolean;

  // Tax info
  regime_tributario: RegimeTributario;
  tipo_empresa: TipoEmpresa;
  tipos_empresa: string[];
  codigo_simples: string | null;
  data_abertura: string | null;
  inicio_escritorio: string | null;

  // Responsible person
  responsavel_nome: string | null;
  responsavel_cpf: string | null;
  responsavel_email: string | null;
  responsavel_telefone: string | null;

  // System access credentials (will be encrypted on backend)
  cpf_empresa: string | null;
  senha_sistema: string | null;
  senha_gov: string | null;
  senha_prefeitura: string | null;
  login_seg_desemp: string | null;
  senha_seg_desemp: string | null;
  email_seg_desemp: string | null;
  senha_nfse: string | null;
  senha_certificado_digital: string | null;
  senha_gcw_resp: string | null;

  // Services and licenses
  servicos_contratados: string[];
  licencas_necessarias: string[];

  // Obligation types (IDs of ObligationType that apply to this client)
  obligation_types_ids: string[];

  // Notes
  observacoes: string | null;
}

export interface ClientCreate extends ClientBase {
  status?: ClientStatus;
}

export interface ClientUserCredentials {
  access: string;
  credential: string;
}

export interface ClientCreateResult {
  client: Client;
  credentials: ClientUserCredentials | null;
}

export interface ClientUpdate extends Partial<ClientBase> {
  status?: ClientStatus;
}

export interface Client extends ClientBase {
  id: string;
  status: ClientStatus;
  created_at: string;
  updated_at: string;
}

export interface ClientListItem {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  email: string;
  status: ClientStatus;
  honorarios_mensais: number;
  regime_tributario: RegimeTributario;
  tipo_empresa: TipoEmpresa;
  created_at: string;
  updated_at: string;

  // Tax info (optional in list view)
  codigo_simples?: string | null;

  // System access credentials (optional in list view)
  cpf_empresa?: string | null;
  senha_sistema?: string | null;
  senha_gov?: string | null;
  senha_prefeitura?: string | null;
  login_seg_desemp?: string | null;
  senha_seg_desemp?: string | null;
  email_seg_desemp?: string | null;
  senha_nfse?: string | null;
  senha_certificado_digital?: string | null;
}

export interface ClientFilters {
  query?: string;
  status?: ClientStatus | '';
  regime_tributario?: RegimeTributario | '';
  tipo_empresa?: TipoEmpresa | '';
  starts_with?: string; // A-Z alphabetical filter
  page?: number;
  size?: number;
}

export interface ClientListResponse {
  items: ClientListItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * Helper function to format CNPJ for display.
 */
export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/**
 * Helper function to format phone number for display.
 */
export function formatPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

/**
 * Helper function to get status display label.
 */
export function getStatusLabel(status: ClientStatus): string {
  const labels: Record<ClientStatus, string> = {
    [ClientStatus.ATIVO]: 'Ativo',
    [ClientStatus.INATIVO]: 'Inativo',
    [ClientStatus.PENDENTE]: 'Pendente',
  };
  return labels[status];
}

/**
 * Helper function to get regime tributario display label.
 */
export function getRegimeLabel(regime: RegimeTributario): string {
  const labels: Record<RegimeTributario, string> = {
    [RegimeTributario.SIMPLES_NACIONAL]: 'Simples Nacional',
    [RegimeTributario.LUCRO_PRESUMIDO]: 'Lucro Presumido',
    [RegimeTributario.LUCRO_REAL]: 'Lucro Real',
    [RegimeTributario.MEI]: 'MEI',
  };
  return labels[regime];
}

/**
 * Helper function to get tipo empresa display label.
 */
export function getTipoEmpresaLabel(tipo: TipoEmpresa | string): string {
  const labels: Record<string, string> = {
    [TipoEmpresa.COMERCIO]: 'Comércio',
    [TipoEmpresa.SERVICO]: 'Serviço',
    [TipoEmpresa.INDUSTRIA]: 'Indústria',
    [TipoEmpresa.FINANCEIRO]: 'Financeiro',
  };
  return labels[tipo] || tipo;
}

/**
 * Helper function to get servico contratado display label.
 */
export function getServicoContratadoLabel(servico: ServicoContratado | string): string {
  const labels: Record<string, string> = {
    [ServicoContratado.FISCAL]: 'Fiscal',
    [ServicoContratado.CONTABIL]: 'Contábil',
    [ServicoContratado.PESSOAL]: 'Pessoal',
  };
  return labels[servico] || servico;
}

/**
 * Helper function to get licenca necessaria display label.
 */
export function getLicencaNecessariaLabel(licenca: LicencaNecessaria | string): string {
  const labels: Record<string, string> = {
    [LicencaNecessaria.LICENCA_SANITARIA]: 'Licença Sanitária',
    [LicencaNecessaria.ARCB_BOMBEIROS]: 'ARCB Bombeiros',
    [LicencaNecessaria.ALVARA_FUNCIONAMENTO]: 'Alvará de Funcionamento',
    [LicencaNecessaria.LICENCA_OPERACOES]: 'Licença de Operações',
    [LicencaNecessaria.BAIXO_RISCO]: 'Baixo Risco',
    [LicencaNecessaria.CERT_ACESSIBILIDADE]: 'Cert. de Acessibilidade',
  };
  return labels[licenca] || licenca;
}

// ========== KPI Stats ==========

export interface ClientStats {
  total: number;
  ativos: number;
  pendentes: number;
  inativos: number;
  receita_total: number;
  ticket_medio: number;
}

// ========== Client Drafts ==========

export interface ClientDraft {
  id: string;
  user_id: string;
  draft_data: Partial<ClientCreate>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientDraftCreate {
  draft_data: Partial<ClientCreate>;
  notes?: string | null;
}

// ========== Obligations Templates ==========

export enum ObligationPeriodicidade {
  MENSAL = 'mensal',
  ANUAL = 'anual',
}

export interface ObligationTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  regime_tributario: RegimeTributario;
  servico_contratado: ServicoContratado;
  periodicidade: ObligationPeriodicidade;
  created_at: string;
  updated_at: string;
}

export interface Obligation {
  nome: string;
  periodicidade: ObligationPeriodicidade;
  tipo: ServicoContratado; // fiscal, contabil, pessoal
}

export interface ObligationsGroup {
  fiscal_mensal: Obligation[];
  fiscal_anual: Obligation[];
  contabil_mensal: Obligation[];
  contabil_anual: Obligation[];
  pessoal_mensal: Obligation[];
  pessoal_anual: Obligation[];
}
