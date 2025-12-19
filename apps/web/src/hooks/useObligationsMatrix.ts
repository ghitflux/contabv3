"use client";

import { useState, useEffect, useCallback } from "react";
import { obligationsApi } from "@/lib/api/endpoints/obligations";

export interface ObligationMatrixItem {
  id: string;
  status: string;
  receipt_url?: string;
  due_date?: string;
  obligation_type_name?: string;
  obligation_type_code?: string;
  recurrence?: string;
}

export interface ClientMatrixRow {
  client_id: string;
  client_name: string;
  client_cnpj: string;
  client_regime_tributario?: string;
  client_tipo_empresa?: string;
  obligations: ObligationMatrixItem[];
  completed: number;
  total: number;
}

interface UseObligationsMatrixOptions {
  month: number;
  year: number;
  search?: string;
  autoFetch?: boolean;
}

export function useObligationsMatrix(options: UseObligationsMatrixOptions) {
  const { month, year, search = "", autoFetch = true } = options;

  const [data, setData] = useState<ClientMatrixRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatrix = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await obligationsApi.getMatrix(month, year, search);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching obligations matrix:", err);
    } finally {
      setLoading(false);
    }
  }, [month, year, search]);

  const completeObligation = async (obligationId: string) => {
    try {
      await obligationsApi.complete(obligationId);
      await fetchMatrix(); // Refresh
    } catch (err) {
      console.error("Error completing obligation:", err);
      throw err;
    }
  };

  const undoObligation = async (obligationId: string) => {
    try {
      await obligationsApi.undo(obligationId);
      await fetchMatrix(); // Refresh
    } catch (err) {
      console.error("Error undoing obligation:", err);
      throw err;
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchMatrix();
    }
  }, [autoFetch, fetchMatrix]);

  return {
    data,
    loading,
    error,
    fetchMatrix,
    completeObligation,
    undoObligation,
  };
}
