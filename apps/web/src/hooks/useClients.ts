/**
 * Hook for managing clients state and operations.
 */

import { clientsApi } from "@/lib/api/endpoints/clients";
import type {
  Client,
  ClientCreate,
  ClientCreateResult,
  ClientFilters,
  ClientListResponse,
  ClientUpdate,
} from "@/types/client";
import { useCallback, useState } from "react";

export function useClients() {
  const [clients, setClients] = useState<ClientListResponse | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async (filters?: ClientFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      // Use max size (100) if not specified to show all clients
      const filtersWithSize = {
        ...filters,
        size: filters?.size ?? 100, // Default to 100 (max allowed by backend)
      };
      const data = await clientsApi.list(filtersWithSize);
      setClients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch clients");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchClientById = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await clientsApi.getById(id);
      setSelectedClient(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch client");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createClient = useCallback(
    async (data: ClientCreate): Promise<ClientCreateResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await clientsApi.create(data);
        // Refresh list
        if (clients) {
          await fetchClients({
            page: clients.page,
            size: clients.size,
          });
        }
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create client");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [clients, fetchClients]
  );

  const updateClient = useCallback(
    async (id: string, data: ClientUpdate) => {
      setIsLoading(true);
      setError(null);

      try {
        const updatedClient = await clientsApi.update(id, data);
        // Refresh list
        if (clients) {
          await fetchClients({
            page: clients.page,
            size: clients.size,
          });
        }
        // Update selected client if it's the one being edited
        if (selectedClient?.id === id) {
          setSelectedClient(updatedClient);
        }
        return updatedClient;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update client");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [clients, selectedClient, fetchClients]
  );

  const deleteClient = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);

      try {
        await clientsApi.delete(id);
        // Refresh list
        if (clients) {
          await fetchClients({
            page: clients.page,
            size: clients.size,
          });
        }
        // Clear selected client if it was deleted
        if (selectedClient?.id === id) {
          setSelectedClient(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete client");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [clients, selectedClient, fetchClients]
  );

  return {
    clients,
    selectedClient,
    isLoading,
    error,
    fetchClients,
    fetchClientById,
    createClient,
    updateClient,
    deleteClient,
    setSelectedClient,
  };
}
