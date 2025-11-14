/**
 * Settings Types
 */

export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export enum LanguageCode {
  PT_BR = 'pt-br',
  EN_US = 'en-us',
  ES_ES = 'es-es',
}

// ======================== USER SETTINGS ========================

export interface UserSettings {
  id: string;
  user_id: string;
  theme_mode: ThemeMode;
  language: LanguageCode;
  notify_email_enabled: boolean;
  notify_obligations: boolean;
  notify_financial: boolean;
  notify_licenses: boolean;
  notify_reports: boolean;
  notify_system: boolean;
  email_digest_enabled: boolean;
  email_digest_frequency: string;
  show_email_publicly: boolean;
  two_factor_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettingsUpdate {
  theme_mode?: ThemeMode;
  language?: LanguageCode;
  notify_email_enabled?: boolean;
  notify_obligations?: boolean;
  notify_financial?: boolean;
  notify_licenses?: boolean;
  notify_reports?: boolean;
  notify_system?: boolean;
  email_digest_enabled?: boolean;
  email_digest_frequency?: string;
  show_email_publicly?: boolean;
  two_factor_enabled?: boolean;
}

// ======================== SYSTEM SETTINGS ========================

export interface SystemSettings {
  id: string;
  company_name: string;
  company_cnpj?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_from_email?: string;
  smtp_use_tls: boolean;
  backup_enabled: boolean;
  backup_frequency?: string;
  backup_retention_days: number;
  api_rate_limit_enabled: boolean;
  api_rate_limit_requests: number;
  api_rate_limit_window_seconds: number;
  enable_two_factor_auth: boolean;
  enable_audit_logging: boolean;
  enable_client_drafts: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemSettingsUpdate {
  company_name?: string;
  company_cnpj?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_from_email?: string;
  smtp_use_tls?: boolean;
  backup_enabled?: boolean;
  backup_frequency?: string;
  backup_retention_days?: number;
  api_rate_limit_enabled?: boolean;
  api_rate_limit_requests?: number;
  api_rate_limit_window_seconds?: number;
  enable_two_factor_auth?: boolean;
  enable_audit_logging?: boolean;
  enable_client_drafts?: boolean;
}

// ======================== SECURITY SETTINGS ========================

export interface SecuritySettings {
  id: string;
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_numbers: boolean;
  password_require_special_chars: boolean;
  password_expiration_days?: number;
  password_history_count: number;
  session_timeout_minutes: number;
  max_concurrent_sessions: number;
  require_password_change_on_first_login: boolean;
  lockout_enabled: boolean;
  lockout_threshold_attempts: number;
  lockout_duration_minutes: number;
  ip_whitelist_enabled: boolean;
  two_factor_required: boolean;
  two_factor_grace_period_days: number;
  created_at: string;
  updated_at: string;
}

export interface SecuritySettingsUpdate {
  password_min_length?: number;
  password_require_uppercase?: boolean;
  password_require_lowercase?: boolean;
  password_require_numbers?: boolean;
  password_require_special_chars?: boolean;
  password_expiration_days?: number;
  password_history_count?: number;
  session_timeout_minutes?: number;
  max_concurrent_sessions?: number;
  require_password_change_on_first_login?: boolean;
  lockout_enabled?: boolean;
  lockout_threshold_attempts?: number;
  lockout_duration_minutes?: number;
  ip_whitelist_enabled?: boolean;
  two_factor_required?: boolean;
  two_factor_grace_period_days?: number;
}

// ======================== CLIENT DEFAULT SETTINGS ========================

export interface ClientDefaultSettings {
  id: string;
  default_payment_day: number;
  default_honorario_amount?: number;
  default_obligation_template_ids?: string;
  default_cnae_ids?: string;
  default_client_status: string;
  default_notification_template?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientDefaultSettingsUpdate {
  default_payment_day?: number;
  default_honorario_amount?: number;
  default_obligation_template_ids?: string;
  default_cnae_ids?: string;
  default_client_status?: string;
  default_notification_template?: string;
}

// ======================== PERMISSIONS ========================

export interface Permission {
  id: string;
  name: string;
  code: string;
  category: string;
  description?: string;
}

export interface RolePermission {
  permission_id: string;
  granted: boolean;
}

export interface RolePermissionsUpdate {
  permissions: Record<string, boolean>;
}

export interface SettingsTabs {
  perfil: 'perfil';
  usuarios: 'usuarios';
  sistema: 'sistema';
  seguranca: 'seguranca';
  permissoes: 'permissoes';
  clientes: 'clientes';
}
