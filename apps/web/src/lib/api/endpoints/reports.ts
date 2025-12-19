/**
 * Reports API endpoints
 */

import { apiClient } from "../client";
import type {
  ReportPreviewRequest,
  ReportPreviewResponse,
  ReportExportRequest,
  ReportExportResponse,
  ReportTemplate,
  ReportTemplateCreate,
  ReportTemplateUpdate,
  ReportHistoryListResponse,
  ReportTypesListResponse,
} from "@/types/report";

export const reportsApi = {
  /**
   * Get all available report types
   */
  async getReportTypes(): Promise<ReportTypesListResponse> {
    return apiClient.get<ReportTypesListResponse>("/reports/types");
  },

  /**
   * Preview a report without generating the file
   */
  async previewReport(request: ReportPreviewRequest): Promise<ReportPreviewResponse> {
    return apiClient.post<ReportPreviewResponse>("/reports/preview", request);
  },

  /**
   * Export a report to file (PDF or CSV)
   */
  async exportReport(request: ReportExportRequest): Promise<ReportExportResponse> {
    return apiClient.post<ReportExportResponse>("/reports/export", request);
  },

  /**
   * Get report templates
   */
  async getTemplates(includeSystem: boolean = true): Promise<ReportTemplate[]> {
    const params = new URLSearchParams();
    if (includeSystem) params.append("include_system", "true");

    const queryString = params.toString();
    const endpoint = queryString ? `/reports/templates?${queryString}` : "/reports/templates";

    return apiClient.get<ReportTemplate[]>(endpoint);
  },

  /**
   * Get a template by ID
   */
  async getTemplateById(id: string): Promise<ReportTemplate> {
    return apiClient.get<ReportTemplate>(`/reports/templates/${id}`);
  },

  /**
   * Create a new report template
   */
  async createTemplate(data: ReportTemplateCreate): Promise<ReportTemplate> {
    return apiClient.post<ReportTemplate>("/reports/templates", data);
  },

  /**
   * Update a report template
   */
  async updateTemplate(id: string, data: ReportTemplateUpdate): Promise<ReportTemplate> {
    return apiClient.put<ReportTemplate>(`/reports/templates/${id}`, data);
  },

  /**
   * Delete a report template
   */
  async deleteTemplate(id: string): Promise<void> {
    return apiClient.delete<void>(`/reports/templates/${id}`);
  },

  /**
   * Get report generation history
   */
  async getHistory(params?: {
    report_type?: string;
    format?: string;
    page?: number;
    size?: number;
  }): Promise<ReportHistoryListResponse> {
    const queryParams = new URLSearchParams();

    if (params?.report_type) queryParams.append("report_type", params.report_type);
    if (params?.format) queryParams.append("format", params.format);
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/reports/history?${queryString}` : "/reports/history";

    return apiClient.get<ReportHistoryListResponse>(endpoint);
  },

  /**
   * Download a generated report file
   */
  async downloadReport(reportId: string, fileName?: string): Promise<{ blob: Blob; filename: string }> {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== "undefined" ? `${window.location.origin}/api/v1` : "");
    const url = `${apiBase}/reports/download/${reportId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Failed to download report (${response.status}) ${detail}`);
    }

    const contentDisposition = response.headers.get("content-disposition");
    const headerFileNameMatch = contentDisposition?.match(/filename=\"?([^\";]+)\"?/i);
    const resolvedName =
      fileName ||
      headerFileNameMatch?.[1] ||
      `report_${reportId}.${contentDisposition?.includes("pdf") ? "pdf" : "csv"}`;

    return { blob: await response.blob(), filename: resolvedName };
  },
};
