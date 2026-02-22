/**
 * Hook for managing licenses state and operations.
 */

import { licensesApi } from "@/lib/api/licenses";
import type { License, LicenseCreate, LicenseFilters, LicenseListResponse, LicenseRenewal, LicenseUpdate, LicenseEvent } from "@/types/license";
import { useCallback, useState } from "react";

export function useLicenses(_filters?: LicenseFilters & { autoFetch?: boolean }) {
  const [licenses, setLicenses] = useState<LicenseListResponse | null>(null);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [events, setEvents] = useState<LicenseEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLicenses = useCallback(async (customFilters?: LicenseFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      const apiFilters = {
        query: customFilters?.search,
        license_type: customFilters?.license_type,
        status: customFilters?.status,
        client_id: customFilters?.client_id,
        include_deleted: customFilters?.include_deleted,
        deleted_only: customFilters?.deleted_only,
        page: customFilters?.page || 1,
        size: customFilters?.size || 10,
      };
      const data = await licensesApi.list(apiFilters);
      setLicenses(data);
      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch licenses";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLicenseById = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await licensesApi.getById(id);
      setSelectedLicense(data);
      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch license";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLicenseEvents = useCallback(async (id: string) => {
    setError(null);
    try {
      const data = await licensesApi.getEvents(id);
      setEvents(data);
      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch license events";
      setError(errorMsg);
      throw err;
    }
  }, []);

  const createLicense = useCallback(
    async (data: LicenseCreate) => {
      setIsLoading(true);
      setError(null);

      try {
        const newLicense = await licensesApi.create(data);
        if (licenses) {
          await fetchLicenses({
            page: licenses.page,
            size: licenses.size,
          });
        }
        return newLicense;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to create license";
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [licenses, fetchLicenses]
  );

  const updateLicense = useCallback(
    async (id: string, data: LicenseUpdate) => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await licensesApi.update(id, data);
        if (selectedLicense?.id === id) {
          setSelectedLicense(updated);
        }
        if (licenses) {
          await fetchLicenses({
            page: licenses.page,
            size: licenses.size,
          });
        }
        return updated;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to update license";
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedLicense, licenses, fetchLicenses]
  );

  const deleteLicense = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);

      try {
        await licensesApi.delete(id);
        if (licenses) {
          await fetchLicenses({
            page: licenses.page,
            size: licenses.size,
          });
        }
        if (selectedLicense?.id === id) {
          setSelectedLicense(null);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to delete license";
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [licenses, selectedLicense, fetchLicenses]
  );

  const renewLicense = useCallback(
    async (id: string, data: LicenseRenewal) => {
      setIsLoading(true);
      setError(null);

      try {
        const renewed = await licensesApi.renew(id, data);
        if (selectedLicense?.id === id) {
          setSelectedLicense(renewed);
        }
        if (licenses) {
          await fetchLicenses({
            page: licenses.page,
            size: licenses.size,
          });
        }
        return renewed;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to renew license";
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedLicense, licenses, fetchLicenses]
  );

  const restoreLicense = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const restored = await licensesApi.restore(id);
        if (selectedLicense?.id === id) {
          setSelectedLicense(restored);
        }
        if (licenses) {
          await fetchLicenses({
            page: licenses.page,
            size: licenses.size,
          });
        }
        return restored;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to restore license";
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedLicense, licenses, fetchLicenses]
  );

  return {
    licenses,
    selectedLicense,
    events,
    isLoading,
    error,
    fetchLicenses,
    fetchLicenseById,
    fetchLicenseEvents,
    createLicense,
    updateLicense,
    deleteLicense,
    renewLicense,
    restoreLicense,
    setSelectedLicense,
  };
}

