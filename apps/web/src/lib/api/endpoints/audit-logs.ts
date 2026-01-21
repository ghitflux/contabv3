/**
 * Audit logs API endpoints.
 */

import { apiClient } from "../client";
import type { AuditLogListResponse } from "@/types/audit";

export const auditLogsApi = {
  async list(params?: {
    client_id?: string;
    user_id?: string;
    action?: string;
    entity?: string;
    skip?: number;
    limit?: number;
  }): Promise<AuditLogListResponse> {
    const query = new URLSearchParams();
    if (params?.client_id) query.append("client_id", params.client_id);
    if (params?.user_id) query.append("user_id", params.user_id);
    if (params?.action) query.append("action", params.action);
    if (params?.entity) query.append("entity", params.entity);
    if (typeof params?.skip === "number") query.append("skip", String(params.skip));
    if (typeof params?.limit === "number") query.append("limit", String(params.limit));
    const qs = query.toString();
    return apiClient.get<AuditLogListResponse>(`/audit-logs${qs ? `?${qs}` : ""}`);
  },
};
