/**
 * Hook for fetching report history.
 */

import { reportsApi } from "@/lib/api/endpoints/reports";
import type { ReportHistoryListResponse } from "@/types/report";
import { useCallback, useEffect, useState } from "react";

interface UseReportHistoryOptions {
  report_type?: string;
  format?: string;
  page?: number;
  size?: number;
  autoFetch?: boolean;
}

export function useReportHistory(options: UseReportHistoryOptions = {}) {
  const { autoFetch = true, ...apiParams } = options;
  const [history, setHistory] = useState<ReportHistoryListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch report history.
   */
  const fetchHistory = useCallback(async (params?: typeof apiParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await reportsApi.getHistory({ ...apiParams, ...params });
      setHistory(data);
      return data;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch report history";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [apiParams]);

  /**
   * Refresh the history.
   */
  const refresh = useCallback(() => {
    return fetchHistory();
  }, [fetchHistory]);

  /**
   * Download a report file.
   */
  const downloadReport = useCallback(async (reportId: string, fileName?: string) => {
    try {
      const { blob, filename } = await reportsApi.downloadReport(reportId, fileName);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to download report";
      setError(message);
      throw err;
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchHistory();
    }
  }, [autoFetch, fetchHistory]);

  return {
    history,
    isLoading,
    error,
    fetchHistory,
    refresh,
    downloadReport,
  };
}
