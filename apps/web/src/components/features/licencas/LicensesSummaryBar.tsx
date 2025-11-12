"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Chip, Spinner } from "@/heroui";
import { licensesApi } from "@/lib/api/licenses";
import {
  LicenseStatus,
  License,
  LicenseType,
  LICENSE_TYPE_LABELS,
  SUMMARY_LICENSE_TYPES,
  normalizeLicenseStatus,
  mapLicenseTypeToSummary,
} from "@/types/license";

type StatusSummary = {
  active: number;
  expired: number;
  renewing: number;
  pending: number;
  cancelled: number;
  unpaid_fees: number;
};

type LicensesSummaryBarProps = {
  clientId?: string | null;
  filters?: Record<string, unknown>;
  refreshKey?: number;
};

const FALLBACK_PAGE_SIZE = 100;

export function LicensesSummaryBar({ clientId, filters, refreshKey }: LicensesSummaryBarProps) {
  const [summary, setSummary] = useState<StatusSummary | null>(null);
  const [byType, setByType] = useState<Record<string, number> | null>(null);
  const [fallbackList, setFallbackList] = useState<License[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!clientId) {
      setSummary(null);
      setByType(null);
      setFallbackList(null);
      setIsLoading(false);
      return () => {};
    }

    const cleanedFilters = { ...(filters ?? {}) };
    delete (cleanedFilters as any).page;
    delete (cleanedFilters as any).size;

    const fetchAllLicenses = async (): Promise<License[]> => {
      if (fallbackList) return fallbackList;

      const accumulated: License[] = [];
      let page = 1;
      let total = 0;

      while (true) {
        const response = await licensesApi.list({
          ...(cleanedFilters ?? {}),
          client_id: clientId ?? undefined,
          page,
          size: FALLBACK_PAGE_SIZE,
        });
        const items = response.items ?? [];
        accumulated.push(...items);
        total = response.total ?? accumulated.length;
        if (accumulated.length >= total || items.length === 0) {
          break;
        }
        page += 1;
      }

      return accumulated;
    };

    const fetchData = async () => {
      setIsLoading(true);
      let cachedList: License[] | null = null;

      const ensureList = async () => {
        if (!cachedList) {
          cachedList = await fetchAllLicenses();
          if (!cancelled) {
            setFallbackList(cachedList);
          }
        }
        return cachedList;
      };

      try {
        const result = await licensesApi.summary(clientId ? { client_id: clientId } : undefined);
        if (!cancelled) {
          setSummary(result);
        }
      } catch {
        const list = await ensureList();
        if (!cancelled) {
          setSummary(calculateStatusSummary(list));
        }
      }

      try {
        const result = await licensesApi.summaryByType();
        if (!cancelled) {
          setByType(result);
        }
      } catch {
        const list = await ensureList();
        if (!cancelled) {
          setByType(calculateTypeSummary(list));
        }
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    };

    fetchData().catch(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId ?? "", JSON.stringify(filters ?? {}), refreshKey]);

  const computedByType = useMemo(() => {
    if (byType) return byType;
    if (!fallbackList) return null;
    return calculateTypeSummary(fallbackList);
  }, [byType, fallbackList]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Resumo de licenças</h2>
        {isLoading && <Spinner size="sm" color="default" />}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatusCard title="Ativas" value={summary?.active ?? 0} chipColor="success" />
        <StatusCard title="Vencidas" value={summary?.expired ?? 0} chipColor="danger" />
        <StatusCard title="Em Renovação" value={summary?.renewing ?? 0} chipColor="default" />
        <StatusCard title="Pendentes" value={summary?.pending ?? 0} chipColor="warning" />
        <StatusCard title="Canceladas" value={summary?.cancelled ?? 0} chipColor="default" />
        <StatusCard title="Taxas em aberto" value={summary?.unpaid_fees ?? 0} chipColor="warning" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SUMMARY_LICENSE_TYPES.map((type) => (
          <Card key={type} className="shadow-sm">
            <CardHeader className="text-sm opacity-70">{LICENSE_TYPE_LABELS[type]}</CardHeader>
            <CardBody>
              <Chip size="lg" variant="flat">
                {computedByType?.[type] ?? 0}
              </Chip>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusCard({
  title,
  value,
  chipColor,
}: {
  title: string;
  value: number;
  chipColor: "success" | "danger" | "warning" | "default";
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="text-sm opacity-70">{title}</CardHeader>
      <CardBody>
        <Chip color={chipColor} size="lg" variant="flat">
          {value ?? 0}
        </Chip>
      </CardBody>
    </Card>
  );
}

function calculateStatusSummary(list: License[]): StatusSummary {
  return list.reduce<StatusSummary>(
    (acc, license) => {
      const status = normalizeLicenseStatus(license.status);
      switch (status) {
        case LicenseStatus.ACTIVE:
          acc.active += 1;
          break;
        case LicenseStatus.EXPIRED:
          acc.expired += 1;
          break;
        case LicenseStatus.RENEWING:
          acc.renewing += 1;
          break;
        case LicenseStatus.PENDING:
          acc.pending += 1;
          break;
        case LicenseStatus.CANCELLED:
        case LicenseStatus.SUSPENDED:
          acc.cancelled += 1;
          break;
        default:
          break;
      }

      if (license.fee !== null && license.fee !== undefined && license.fee_paid === false) {
        acc.unpaid_fees += 1;
      }

      return acc;
    },
    {
      active: 0,
      expired: 0,
      renewing: 0,
      pending: 0,
      cancelled: 0,
      unpaid_fees: 0,
    }
  );
}

function calculateTypeSummary(list: License[]): Record<string, number> {
  const counts: Record<string, number> = {};
  SUMMARY_LICENSE_TYPES.forEach((type) => {
    counts[type] = 0;
  });

  list.forEach((license) => {
    const summaryType = mapLicenseTypeToSummary(license.license_type);
    counts[summaryType] = (counts[summaryType] ?? 0) + 1;
  });

  return counts;
}

