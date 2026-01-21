"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";

export interface Obligation {
  id: string;
  client_id: string;
  client_name: string;
  client_cnpj: string;
  obligation_type_id: string;
  obligation_type_name: string;
  obligation_type_code: string;
  status: "pending" | "completed" | "cancelled";
  due_date: string;
  completed_at?: string;
  receipt_url?: string;
  description?: string;
  created_at: string;
  updated_at?: string;
}

interface UseObligationsOptions {
  clientId?: string;
  status?: string;
  year?: number;
  month?: number;
  autoFetch?: boolean;
}

type ObligationsListResponse = {
  items: Obligation[];
  total: number;
  skip: number;
  limit: number;
};

export function useObligations(options: UseObligationsOptions = {}) {
  const { clientId, status, year, month, autoFetch = true } = options;

  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(10);

  const fetchObligations = useCallback(
    async (skip = 0) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          skip: skip.toString(),
          limit: limit.toString(),
        });

        // Adicionar client_id apenas se fornecido
        if (clientId) {
          params.append("client_id", clientId);
        }

        if (status) params.append("status", status);
        if (year) params.append("year", year.toString());
        if (month) params.append("month", month.toString());

        const endpoint = `/obligations?${params.toString()}`;
        const data = await apiClient.get<ObligationsListResponse>(endpoint);
        // Transform obligations to include client info if not present
        const transformedItems = data.items.map((item: any) => ({
          ...item,
          client_name: item.client_name || item.client?.razao_social || "",
          client_cnpj: item.client_cnpj || item.client?.cnpj || "",
          obligation_type_name: item.obligation_type_name || item.obligation_type?.name || "",
          obligation_type_code: item.obligation_type_code || item.obligation_type?.code || "",
        }));
        setObligations(transformedItems);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    },
    [clientId, status, year, month, limit]
  );

  const generateObligations = async (
    year: number,
    month: number,
    clientId?: string
  ) => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiClient.post("/obligations/generate", {
        year,
        month,
        client_id: clientId,
      });
      await fetchObligations();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const uploadReceipt = async (
    obligationId: string,
    file: File,
    notes?: string
  ) => {
    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);
      if (notes) formData.append("notes", notes);

      const data = await apiClient.upload(
        `/obligations/${obligationId}/receipt`,
        formData
      );
      await fetchObligations();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cancelObligation = async (obligationId: string, reason: string) => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiClient.post(`/obligations/${obligationId}/cancel`, { reason });
      await fetchObligations();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateDueDate = async (
    obligationId: string,
    newDueDate: string,
    reason: string
  ) => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiClient.put(`/obligations/${obligationId}/due-date`, {
        new_due_date: newDueDate,
        reason,
      });
      await fetchObligations();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchObligations(page * limit);
    }
  }, [autoFetch, clientId, status, year, month, page, limit, fetchObligations]);

  const nextPage = () => {
    if ((page + 1) * limit < total) {
      setPage(page + 1);
    }
  };

  const prevPage = () => {
    if (page > 0) {
      setPage(page - 1);
    }
  };

  return {
    obligations,
    loading,
    error,
    total,
    page,
    limit,
    fetchObligations,
    generateObligations,
    uploadReceipt,
    cancelObligation,
    updateDueDate,
    nextPage,
    prevPage,
  };
}
