/**
 * Hook for exporting reports.
 */

import { reportsApi } from "@/lib/api/endpoints/reports";
import type {
  ReportExportRequest,
  ReportExportResponse,
} from "@/types/report";
import { useCallback, useState } from "react";

export function useReportExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ReportExportResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  /**
   * Export report in the specified format.
   */
  const exportReport = useCallback(async (request: ReportExportRequest) => {
    setIsExporting(true);
    setError(null);
    setExportResult(null);

    try {
      const data = await reportsApi.exportReport(request);
      setExportResult(data);
      return data;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to export report";
      setError(message);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, []);

  /**
   * Download a previously generated report file.
   */
  const downloadReport = useCallback(async (reportId: string, filename?: string) => {
    setIsExporting(true);
    setError(null);

    try {
      const { blob, filename: downloadedFilename } = await reportsApi.downloadReport(reportId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || downloadedFilename || `report-${reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to download report";
      setError(message);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, []);

  /**
   * Clear the export result.
   */
  const clearExport = useCallback(() => {
    setExportResult(null);
    setError(null);
  }, []);

  return {
    isExporting,
    exportResult,
    error,
    exportReport,
    downloadReport,
    clearExport,
  };
}

