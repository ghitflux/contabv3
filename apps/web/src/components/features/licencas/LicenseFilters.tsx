"use client";

import { useState } from "react";
import { Select, SelectItem, Button, Input } from "@/heroui";
import {
  LicenseType,
  LicenseStatus,
  LICENSE_TYPE_LABELS,
  LICENSE_STATUS_LABELS,
  SUMMARY_LICENSE_TYPES,
  SUMMARY_LICENSE_STATUSES,
} from "@/types/license";

interface LicenseFiltersProps {
  onFilterChange?: (filters: {
    query?: string;
    license_type?: LicenseType;
    status?: LicenseStatus;
    expiring_soon?: boolean;
    expired?: boolean;
  }) => void;
  onCreateClick?: () => void;
}

export function LicenseFilters({
  onFilterChange,
  onCreateClick,
}: LicenseFiltersProps) {
  const [query, setQuery] = useState<string>("");
  const [licenseType, setLicenseType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [showExpiring, setShowExpiring] = useState<boolean>(false);
  const [showExpired, setShowExpired] = useState<boolean>(false);

  const licenseTypeItems = [
    { key: "all", label: "Todos" },
    ...Array.from(
      new Set([...SUMMARY_LICENSE_TYPES, LicenseType.INSCRICAO_MUNICIPAL, LicenseType.CERTIFICADO_DIGITAL])
    ).map((type) => ({
      key: type,
      label: LICENSE_TYPE_LABELS[type],
    })),
  ];

  const statusItems = [
    { key: "all", label: "Todos" },
    ...Array.from(new Set([...SUMMARY_LICENSE_STATUSES, LicenseStatus.SUSPENDED])).map((stat) => ({
      key: stat,
      label: LICENSE_STATUS_LABELS[stat],
    })),
  ];

  const handleApplyFilters = () => {
    onFilterChange?.({
      query: query || undefined,
      license_type:
        licenseType && licenseType !== "all"
          ? (licenseType as LicenseType)
          : undefined,
      status:
        status && status !== "all" ? (status as LicenseStatus) : undefined,
      expiring_soon: showExpiring || undefined,
      expired: showExpired || undefined,
    });
  };

  const handleClearFilters = () => {
    setQuery("");
    setLicenseType("all");
    setStatus("all");
    setShowExpiring(false);
    setShowExpired(false);
    onFilterChange?.({});
  };

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <Input
        label="Buscar"
        placeholder="Número de registro ou órgão emissor"
        className="w-64"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === "Enter") {
            handleApplyFilters();
          }
        }}
      />

      <Select
        label="Tipo"
        placeholder="Todos"
        className="w-48"
        selectedKeys={licenseType ? [licenseType] : []}
        onSelectionChange={(keys) =>
          setLicenseType(Array.from(keys)[0] as string)
        }
        items={licenseTypeItems}
      >
        {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
      </Select>

      <Select
        label="Status"
        placeholder="Todos"
        className="w-40"
        selectedKeys={status ? [status] : []}
        onSelectionChange={(keys) => setStatus(Array.from(keys)[0] as string)}
        items={statusItems}
      >
        {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
      </Select>

      <div className="flex gap-2">
        <Button
          variant={showExpiring ? "solid" : "bordered"}
          color={showExpiring ? "warning" : "default"}
          size="sm"
          onPress={() => setShowExpiring(!showExpiring)}
        >
          Vencendo em breve
        </Button>
        <Button
          variant={showExpired ? "solid" : "bordered"}
          color={showExpired ? "danger" : "default"}
          size="sm"
          onPress={() => setShowExpired(!showExpired)}
        >
          Vencidas
        </Button>
      </div>

      <div className="flex gap-2">
        <Button color="primary" onPress={handleApplyFilters}>
          Aplicar
        </Button>
        <Button variant="flat" onPress={handleClearFilters}>
          Limpar
        </Button>
      </div>

      <div className="flex-1" />

      {onCreateClick && (
        <Button color="success" onPress={onCreateClick}>
          Nova Licença
        </Button>
      )}
    </div>
  );
}

