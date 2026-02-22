/**
 * License related types, enums and helpers.
 */

// -----------------------------
// Enums & label dictionaries
// -----------------------------

export enum LicenseType {
  ALVARA_FUNC = "alvara_funcionamento",
  LIC_SANITARIA = "licenca_sanitaria",
  AVCB_BOMBEIROS = "licenca_bombeiros",
  LIC_AMBIENTAL = "licenca_ambiental",
  IE_ICMS = "inscricao_estadual",
  OUTRA = "outros",
  INSCRICAO_MUNICIPAL = "inscricao_municipal",
  CERTIFICADO_DIGITAL = "certificado_digital",
}

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  [LicenseType.ALVARA_FUNC]: "Alvará de Funcionamento",
  [LicenseType.LIC_SANITARIA]: "Licença Sanitária",
  [LicenseType.AVCB_BOMBEIROS]: "AVCB/CLCB",
  [LicenseType.LIC_AMBIENTAL]: "Licença Ambiental",
  [LicenseType.IE_ICMS]: "Inscrição Estadual",
  [LicenseType.OUTRA]: "Outras",
  [LicenseType.INSCRICAO_MUNICIPAL]: "Inscrição Municipal",
  [LicenseType.CERTIFICADO_DIGITAL]: "Certificado Digital",
};

export const SUMMARY_LICENSE_TYPES: LicenseType[] = [
  LicenseType.ALVARA_FUNC,
  LicenseType.LIC_SANITARIA,
  LicenseType.AVCB_BOMBEIROS,
  LicenseType.LIC_AMBIENTAL,
  LicenseType.IE_ICMS,
  LicenseType.OUTRA,
];

export enum LicenseStatus {
  ACTIVE = "ativa",
  EXPIRED = "vencida",
  PENDING = "pendente_renovacao",
  RENEWING = "em_processo",
  CANCELLED = "cancelada",
  SUSPENDED = "suspensa",
}

export const LICENSE_STATUS_LABELS: Record<LicenseStatus, string> = {
  [LicenseStatus.ACTIVE]: "Ativa",
  [LicenseStatus.EXPIRED]: "Vencida",
  [LicenseStatus.PENDING]: "Pendente",
  [LicenseStatus.RENEWING]: "Em Renovação",
  [LicenseStatus.CANCELLED]: "Cancelada",
  [LicenseStatus.SUSPENDED]: "Suspensa",
};

export const SUMMARY_LICENSE_STATUSES: LicenseStatus[] = [
  LicenseStatus.ACTIVE,
  LicenseStatus.EXPIRED,
  LicenseStatus.RENEWING,
  LicenseStatus.PENDING,
  LicenseStatus.CANCELLED,
];

export enum LicenseEventType {
  CREATED = "created",
  ISSUED = "issued",
  RENEWED = "renewed",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
  SUSPENDED = "suspended",
  REACTIVATED = "reactivated",
  UPDATED = "updated",
  DOCUMENT_UPLOADED = "document_uploaded",
}

export const LICENSE_EVENT_TYPE_LABELS: Record<LicenseEventType, string> = {
  [LicenseEventType.CREATED]: "Criada",
  [LicenseEventType.ISSUED]: "Emitida",
  [LicenseEventType.RENEWED]: "Renovada",
  [LicenseEventType.EXPIRED]: "Vencida",
  [LicenseEventType.CANCELLED]: "Cancelada",
  [LicenseEventType.SUSPENDED]: "Suspensa",
  [LicenseEventType.REACTIVATED]: "Reativada",
  [LicenseEventType.UPDATED]: "Atualizada",
  [LicenseEventType.DOCUMENT_UPLOADED]: "Documento Anexado",
};

// -----------------------------
// Normalisation helpers
// -----------------------------

const LICENSE_TYPE_ALIASES: Record<string, LicenseType> = {
  alvara_func: LicenseType.ALVARA_FUNC,
  alvara_funcionamento: LicenseType.ALVARA_FUNC,
  lic_sanitaria: LicenseType.LIC_SANITARIA,
  licenca_sanitaria: LicenseType.LIC_SANITARIA,
  avcb_bombeiros: LicenseType.AVCB_BOMBEIROS,
  avcb_clcb: LicenseType.AVCB_BOMBEIROS,
  licenca_bombeiros: LicenseType.AVCB_BOMBEIROS,
  lic_ambiental: LicenseType.LIC_AMBIENTAL,
  licenca_ambiental: LicenseType.LIC_AMBIENTAL,
  inscricao_estadual: LicenseType.IE_ICMS,
  ie_icms: LicenseType.IE_ICMS,
  outra: LicenseType.OUTRA,
  outras: LicenseType.OUTRA,
  outros: LicenseType.OUTRA,
  inscricao_municipal: LicenseType.INSCRICAO_MUNICIPAL,
  certificado_digital: LicenseType.CERTIFICADO_DIGITAL,
};

export function normalizeLicenseType(value: string | LicenseType | null | undefined): LicenseType {
  if (!value) return LicenseType.OUTRA;
  if (Object.values(LicenseType).includes(value as LicenseType)) {
    return value as LicenseType;
  }
  const parsed = LICENSE_TYPE_ALIASES[value.toString().toLowerCase()];
  return parsed ?? LicenseType.OUTRA;
}

const LICENSE_STATUS_ALIASES: Record<string, LicenseStatus> = {
  active: LicenseStatus.ACTIVE,
  ativa: LicenseStatus.ACTIVE,
  expired: LicenseStatus.EXPIRED,
  vencida: LicenseStatus.EXPIRED,
  pending: LicenseStatus.PENDING,
  pendente: LicenseStatus.PENDING,
  pendente_renovacao: LicenseStatus.PENDING,
  renewing: LicenseStatus.RENEWING,
  em_processo: LicenseStatus.RENEWING,
  em_renovacao: LicenseStatus.RENEWING,
  cancelled: LicenseStatus.CANCELLED,
  cancelada: LicenseStatus.CANCELLED,
  cancelled_out: LicenseStatus.CANCELLED,
  suspended: LicenseStatus.SUSPENDED,
  suspensa: LicenseStatus.SUSPENDED,
};

export function normalizeLicenseStatus(value: string | LicenseStatus | null | undefined): LicenseStatus {
  if (!value) return LicenseStatus.CANCELLED;
  if (Object.values(LicenseStatus).includes(value as LicenseStatus)) {
    return value as LicenseStatus;
  }
  const parsed = LICENSE_STATUS_ALIASES[value.toString().toLowerCase()];
  return parsed ?? LicenseStatus.CANCELLED;
}

export function mapLicenseTypeToSummary(value: string | LicenseType | null | undefined): LicenseType {
  const normalized = normalizeLicenseType(value);
  if (SUMMARY_LICENSE_TYPES.includes(normalized)) {
    return normalized;
  }
  return LicenseType.OUTRA;
}

// -----------------------------
// Base interfaces
// -----------------------------

export interface LicenseBase {
  client_id: string;
  license_type: LicenseType | string;
  registration_number: string;
  issuing_authority: string;
  issue_date: string; // ISO date string
  expiration_date: string | null;
  notes?: string | null;
  fee?: number | null;
  fee_paid?: boolean;
}

export interface LicenseCreate extends LicenseBase {
  status?: LicenseStatus;
  document_id?: string | null;
}

export interface LicenseUpdate {
  license_type?: LicenseType | string;
  registration_number?: string;
  issuing_authority?: string;
  issue_date?: string;
  expiration_date?: string | null;
  status?: LicenseStatus | string;
  notes?: string | null;
  document_id?: string | null;
  fee?: number | null;
  fee_paid?: boolean;
}

export interface LicenseRenewal {
  new_issue_date: string;
  new_expiration_date?: string | null;
  new_registration_number?: string | null;
  notes?: string | null;
  document_id?: string | null;
}

export interface License extends LicenseBase {
  id: string;
  status: LicenseStatus | string;
  document_id?: string | null;
  document_url?: string | null;
  created_at?: string;
  updated_at?: string;
  days_until_expiration?: number | null;
  is_expired?: boolean;
  is_expiring_soon?: boolean;
  client_name?: string;
}

// -----------------------------
// Events
// -----------------------------

export interface LicenseEventBase {
  event_type: LicenseEventType;
  description: string;
  user_id?: string | null;
}

export interface LicenseEventCreate extends LicenseEventBase {
  license_id: string;
}

export interface LicenseEvent extends LicenseEventBase {
  id: string;
  license_id: string;
  created_at: string;
  user_name?: string;
}

export type LicenseEventResponse = LicenseEvent;

// -----------------------------
// API response helpers
// -----------------------------

export interface LicenseListResponse {
  items: License[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface LicenseStatistics {
  total_licenses: number;
  active_licenses: number;
  expired_licenses: number;
  expiring_soon: number;
  pending_renewal: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
}

export interface LicenseFilters {
  client_id?: string;
  license_type?: LicenseType | string;
  status?: LicenseStatus | string;
  search?: string;
  expiring_soon?: boolean;
  expired?: boolean;
  include_deleted?: boolean;
  deleted_only?: boolean;
  page?: number;
  size?: number;
}

// -----------------------------
// Helper functions
// -----------------------------

export function getLicenseStatusColor(
  status: LicenseStatus | string | null | undefined
): "success" | "warning" | "danger" | "default" {
  switch (normalizeLicenseStatus(status)) {
    case LicenseStatus.ACTIVE:
      return "success";
    case LicenseStatus.RENEWING:
    case LicenseStatus.PENDING:
      return "warning";
    case LicenseStatus.EXPIRED:
    case LicenseStatus.CANCELLED:
    case LicenseStatus.SUSPENDED:
      return "danger";
    default:
      return "default";
  }
}

export function getExpirationBadgeColor(license: License): "success" | "warning" | "danger" {
  if (license.is_expired) {
    return "danger";
  }
  if (license.is_expiring_soon) {
    return "warning";
  }
  return "success";
}

export function formatExpirationStatus(license: License): string {
  if (license.is_expired) {
    return `Vencida há ${Math.abs(license.days_until_expiration || 0)} dias`;
  }
  if (license.is_expiring_soon && license.days_until_expiration !== null && license.days_until_expiration !== undefined) {
    return `Vence em ${license.days_until_expiration} dias`;
  }
  return "Vigente";
}
