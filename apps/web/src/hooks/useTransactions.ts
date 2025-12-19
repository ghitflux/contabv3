/**
 * Hook for managing financial transactions.
 */

import { financeApi } from "@/lib/api/endpoints/finance";
import type { FinancialTransaction, TransactionFilters } from "@/types/finance";
import { useCallback, useEffect, useState } from "react";

interface UseTransactionsOptions {
  filters?: TransactionFilters;
  autoFetch?: boolean;
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { filters, autoFetch = true } = options;
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  /**
   * Fetch transactions from API.
   */
  const fetchTransactions = useCallback(async (customFilters?: TransactionFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await financeApi.getTransactions({
        ...filters,
        ...customFilters,
      });

      setTransactions(response.items);
      setTotal(response.total);
      return response;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch transactions";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  /**
   * Create a new transaction.
   */
  const createTransaction = useCallback(async (data: Partial<FinancialTransaction>) => {
    try {
      const created = await financeApi.createTransaction(data);
      setTransactions((prev) => [created, ...prev]);
      setTotal((prev) => prev + 1);
      return created;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create transaction";
      setError(message);
      throw err;
    }
  }, []);

  /**
   * Update a transaction.
   */
  const updateTransaction = useCallback(async (
    id: string,
    data: Partial<FinancialTransaction>
  ) => {
    try {
      const updated = await financeApi.updateTransaction(id, data);
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? updated : t))
      );
      return updated;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update transaction";
      setError(message);
      throw err;
    }
  }, []);

  /**
   * Delete a transaction.
   */
  const deleteTransaction = useCallback(async (id: string) => {
    try {
      await financeApi.deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete transaction";
      setError(message);
      throw err;
    }
  }, []);

  /**
   * Refresh transactions.
   */
  const refresh = useCallback(() => {
    return fetchTransactions();
  }, [fetchTransactions]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchTransactions();
    }
  }, [autoFetch, fetchTransactions]);

  return {
    transactions,
    total,
    isLoading,
    error,
    fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    refresh,
  };
}
