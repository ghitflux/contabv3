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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface UseTransactionsOptions {
  filters?: TransactionFilters;
  autoFetch?: boolean;
  fetchAllPages?: boolean;
}

const dedupeTransactionsById = (items: Transaction[]): Transaction[] => {
  const uniqueById = new Map<string, Transaction>();
  for (const item of items) {
    if (!uniqueById.has(item.id)) {
      uniqueById.set(item.id, item);
    }
  }
  return Array.from(uniqueById.values());
};

const buildFiltersKey = (filters?: TransactionFilters) => {
  const normalized = {
    client_id: filters?.client_id ?? null,
    status: filters?.status ?? null,
    payment_method: filters?.payment_method ?? null,
    reference_month: filters?.reference_month ?? null,
    reference_month_from: filters?.reference_month_from ?? null,
    reference_month_to: filters?.reference_month_to ?? null,
    due_date_from: filters?.due_date_from ?? null,
    due_date_to: filters?.due_date_to ?? null,
    include_deleted: Boolean(filters?.include_deleted),
    deleted_only: Boolean(filters?.deleted_only),
    page: filters?.page ?? null,
    size: filters?.size ?? null,
  };

  return JSON.stringify(normalized);
};

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { filters, autoFetch = true, fetchAllPages = false } = options;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const filtersRef = useRef<TransactionFilters | undefined>(filters);
  const filtersKey = useMemo(() => buildFiltersKey(filters), [filters]);

  const normalizeTransaction = useCallback((transaction: Transaction): Transaction => {
    const amount =
      typeof transaction.amount === 'string' ? Number(transaction.amount) : transaction.amount;
    return { ...transaction, amount };
  }, []);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters, filtersKey]);

  /**
   * Fetch transactions from API.
   */
  const fetchTransactions = useCallback(
    async (customFilters?: TransactionFilters) => {
      const mergedFilters = {
        ...(filtersRef.current ?? {}),
        ...(customFilters ?? {}),
      };

      // Note: client_id is now optional - backend will handle authorization
      // - Admin/Func: can fetch all transactions (no client_id) or filter by client_id
      // - Cliente: backend will override client_id with their own

      setIsLoading(true);
      setError(null);

      try {
        if (!fetchAllPages) {
          const response = await financeApi.getTransactions(mergedFilters);
          const normalizedItems = response.items.map(normalizeTransaction);
          const dedupedItems = dedupeTransactionsById(normalizedItems);
          setTransactions(dedupedItems);
          setTotal(response.total);
          return { ...response, items: dedupedItems };
        }

        const pageSize =
          typeof mergedFilters.size === 'number' && mergedFilters.size > 0
            ? Math.min(Math.trunc(mergedFilters.size), 100)
            : 100;

        let currentPage = 1;
        let totalFromApi = 0;
        const allItems: Transaction[] = [];

        while (true) {
          const response = await financeApi.getTransactions({
            ...mergedFilters,
            page: currentPage,
            size: pageSize,
          });

          const normalizedItems = response.items.map(normalizeTransaction);
          allItems.push(...normalizedItems);
          totalFromApi = response.total;

          const reachedEnd =
            normalizedItems.length === 0 ||
            normalizedItems.length < pageSize ||
            allItems.length >= totalFromApi;

          if (reachedEnd) {
            break;
          }

          currentPage += 1;
        }

        const dedupedAllItems = dedupeTransactionsById(allItems);
        setTransactions(dedupedAllItems);
        setTotal(totalFromApi);

        return {
          items: dedupedAllItems,
          total: totalFromApi,
          skip: 0,
          limit: pageSize,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch transactions';
        setError(message);
        console.error('[useTransactions] Fetch error:', message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchAllPages, normalizeTransaction]
  );

  /**
   * Create a new transaction.
   */
  const createTransaction = useCallback(
    async (data: TransactionCreate) => {
      try {
        const created = normalizeTransaction(await financeApi.createTransaction(data));
        setTransactions((prev) => dedupeTransactionsById([created, ...prev]));
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
          return dedupeTransactionsById([restored, ...prev]);
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

  // Auto-fetch whenever active filters change
  useEffect(() => {
    if (autoFetch) {
      fetchTransactions().catch((err) => {
        console.error('[useTransactions] Auto-fetch error:', err);
      });
    }
  }, [autoFetch, fetchTransactions, filtersKey]);

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
