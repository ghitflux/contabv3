export interface AuditLog {
  id: string;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_role?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  payload?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  items: AuditLog[];
  total: number;
  skip: number;
  limit: number;
}
