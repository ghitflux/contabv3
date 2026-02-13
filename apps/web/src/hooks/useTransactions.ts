/**
 * Hook for managing financial transactions.
 */

import { financeApi } from '@/lib/api/endpoints/finance';
import type {
  Transaction,
  TransactionCreate,
  TransactionUpdate,
  TransactionFilters,
} from '@/types/finance';
import { useCallback, useEffect, useState } from 'react';

interface UseTransactionsOptions {
  filters?: TransactionFilters;
  autoFetch?: boolean;
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { filters, autoFetch = true } = options;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const normalizeTransaction = useCallback((transaction: Transaction): Transaction => {
    const amount =
      typeof transaction.amount === 'string' ? Number(transaction.amount) : transaction.amount;
    return { ...transaction, amount };
  }, []);

  /**
   * Fetch transactions from API.
   */
  const fetchTransactions = useCallback(
    async (customFilters?: TransactionFilters) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await financeApi.getTransactions({
          ...filters,
          ...customFilters,
        });

        const normalizedItems = response.items.map(normalizeTransaction);
        setTransactions(normalizedItems);
        setTotal(response.total);
        return { ...response, items: normalizedItems };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch transactions';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [filters, normalizeTransaction]
  );

  /**
   * Create a new transaction.
   */
  const createTransaction = useCallback(
    async (data: TransactionCreate) => {
      try {
        const created = normalizeTransaction(await financeApi.createTransaction(data));
        setTransactions((prev) => [created, ...prev]);
        setTotal((prev) => prev + 1);
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create transaction';
        setError(message);
        throw err;
      }
    },
    [normalizeTransaction]
  );

  /**
   * Update a transaction.
   */
  const updateTransaction = useCallback(
    async (id: string, data: TransactionUpdate) => {
      try {
        const updated = normalizeTransaction(await financeApi.updateTransaction(id, data));
        setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update transaction';
        setError(message);
        throw err;
      }
    },
    [normalizeTransaction]
  );

  /**
   * Delete a transaction.
   */
  const deleteTransaction = useCallback(async (id: string) => {
    try {
      await financeApi.deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete transaction';
      setError(message);
      throw err;
    }
  }, []);

  /**
   * Restore a soft-deleted transaction.
   */
  const restoreTransaction = useCallback(
    async (id: string) => {
      try {
        const restored = normalizeTransaction(await financeApi.restoreTransaction(id));
        setTransactions((prev) => {
          if (prev.some((transaction) => transaction.id === id)) {
            return prev.map((transaction) => (transaction.id === id ? restored : transaction));
          }
          return [restored, ...prev];
        });
        setTotal((prev) => prev + 1);
        return restored;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to restore transaction';
        setError(message);
        throw err;
      }
    },
    [normalizeTransaction]
  );

  /**
   * Refresh transactions.
   */
  const refresh = useCallback(() => {
    return fetchTransactions();
  }, [fetchTransactions]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchTransactions().catch((err) => {
        console.error('Erro ao buscar lançamentos', err);
      });
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
    restoreTransaction,
    refresh,
  };
}
