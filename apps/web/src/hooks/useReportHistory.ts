/**
 * Hook for fetching report history.
 */

import { reportsApi } from '@/lib/api/endpoints/reports';
import type { ReportHistoryListResponse } from '@/types/report';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface UseReportHistoryOptions {
  report_type?: string;
  format?: string;
  page?: number;
  size?: number;
  include_deleted?: boolean;
  deleted_only?: boolean;
  autoFetch?: boolean;
}

export function useReportHistory(options: UseReportHistoryOptions = {}) {
  const {
    autoFetch = true,
    report_type,
    format,
    page,
    size,
    include_deleted = false,
    deleted_only = false,
  } = options;

  const apiParams = useMemo(
    () => ({
      report_type,
      format,
      page,
      size,
      include_deleted,
      deleted_only,
    }),
    [report_type, format, page, size, include_deleted, deleted_only]
  );

  const [history, setHistory] = useState<ReportHistoryListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch report history.
   */
  const fetchHistory = useCallback(
    async (params?: typeof apiParams) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await reportsApi.getHistory({ ...apiParams, ...params });
        setHistory(data);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch report history';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiParams]
  );

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
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download report';
      setError(message);
      throw err;
    }
  }, []);

  /**
   * Delete a generated report from history.
   */
  const deleteReport = useCallback(
    async (reportId: string) => {
      try {
        await reportsApi.deleteReport(reportId);
        await fetchHistory();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete report';
        setError(message);
        throw err;
      }
    },
    [fetchHistory]
  );

  /**
   * Restore a report from trash.
   */
  const restoreReport = useCallback(
    async (reportId: string) => {
      try {
        await reportsApi.restoreReport(reportId);
        await fetchHistory();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to restore report';
        setError(message);
        throw err;
      }
    },
    [fetchHistory]
  );

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
    deleteReport,
    restoreReport,
  };
}
