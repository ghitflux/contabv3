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
import { useCallback, useEffect, useState, useRef } from 'react';

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef(false);

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
      // Prevent concurrent fetches
      if (isFetchingRef.current) {
        console.log('[useTransactions] Already fetching, skipping...');
        return { items: transactions, total, page: 1, size: 100, pages: 1 };
      }

      // Cancel previous request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const mergedFilters = { ...filters, ...customFilters };

      // Note: client_id is now optional - backend will handle authorization
      // - Admin/Func: can fetch all transactions (no client_id) or filter by client_id
      // - Cliente: backend will override client_id with their own

      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        abortControllerRef.current = new AbortController();
        const response = await financeApi.getTransactions(mergedFilters);

        const normalizedItems = response.items.map(normalizeTransaction);
        setTransactions(normalizedItems);
        setTotal(response.total);
        return { ...response, items: normalizedItems };
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[useTransactions] Request aborted');
          return { items: transactions, total, page: 1, size: 100, pages: 1 };
        }

        const message = err instanceof Error ? err.message : 'Failed to fetch transactions';
        setError(message);
        console.error('[useTransactions] Fetch error:', message);
        throw err;
      } finally {
        isFetchingRef.current = false;
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [filters, normalizeTransaction, transactions, total]
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

  // Auto-fetch on mount - FIXED: only once when client_id changes
  useEffect(() => {
    if (autoFetch && filters?.client_id) {
      fetchTransactions().catch((err) => {
        console.error('[useTransactions] Auto-fetch error:', err);
      });
    }

    return () => {
      // Cleanup: abort ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, filters?.client_id]); // Only re-run when client_id changes

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
