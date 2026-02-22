"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/heroui";
import { RefreshCcw, RotateCcw, Search, Trash2 } from "lucide-react";
import {
  LICENSE_STATUS_LABELS,
  LICENSE_TYPE_LABELS,
  License,
  LicenseStatus,
  normalizeLicenseStatus,
  normalizeLicenseType,
} from "@/types/license";

interface LicencasLixeiraProps {
  clientLicenses: License[];
  officeLicenses: License[];
  canSeeOffice: boolean;
  isLoading?: boolean;
  restoringId?: string | null;
  onRefresh: () => void;
  onRestore: (license: License) => void;
}

function formatDatePtBR(dateString: string | null | undefined) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function getTrashReason(status: LicenseStatus) {
  if (status === LicenseStatus.CANCELLED) return "Excluída";
  if (status === LicenseStatus.EXPIRED) return "Expirada";
  return "Lixeira";
}

function applySearch(list: License[], search: string) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return list;
  return list.filter((license) => {
    const company = (license.client_name || "").toLowerCase();
    const registration = (license.registration_number || "").toLowerCase();
    const authority = (license.issuing_authority || "").toLowerCase();
    const type = LICENSE_TYPE_LABELS[normalizeLicenseType(license.license_type)].toLowerCase();
    const status = LICENSE_STATUS_LABELS[normalizeLicenseStatus(license.status)].toLowerCase();
    return (
      company.includes(normalized) ||
      registration.includes(normalized) ||
      authority.includes(normalized) ||
      type.includes(normalized) ||
      status.includes(normalized)
    );
  });
}

function TrashTable({
  title,
  items,
  showCompany,
  restoringId,
  onRestore,
}: {
  title: string;
  items: License[];
  showCompany: boolean;
  restoringId?: string | null;
  onRestore: (license: License) => void;
}) {
  return (
    <Card className="border border-default-200/60">
      <CardHeader className="pb-2">
        <h4 className="text-base font-semibold">{title}</h4>
      </CardHeader>
      <CardBody className="pt-0">
        {showCompany ? (
          <Table aria-label={title} removeWrapper>
            <TableHeader>
              <TableColumn>Empresa</TableColumn>
              <TableColumn>Tipo</TableColumn>
              <TableColumn>Registro</TableColumn>
              <TableColumn>Vencimento</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Na lixeira por</TableColumn>
              <TableColumn className="text-right">Ação</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Nenhuma licença na lixeira">
              {items.map((license) => {
                const status = normalizeLicenseStatus(license.status);
                return (
                  <TableRow key={license.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{license.client_name || "-"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {LICENSE_TYPE_LABELS[normalizeLicenseType(license.license_type)]}
                    </TableCell>
                    <TableCell>{license.registration_number || "-"}</TableCell>
                    <TableCell>{formatDatePtBR(license.expiration_date)}</TableCell>
                    <TableCell>{LICENSE_STATUS_LABELS[status]}</TableCell>
                    <TableCell>{getTrashReason(status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<RotateCcw className="h-4 w-4" />}
                        onPress={() => onRestore(license)}
                        isLoading={restoringId === license.id}
                      >
                        Restaurar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <Table aria-label={title} removeWrapper>
            <TableHeader>
              <TableColumn>Tipo</TableColumn>
              <TableColumn>Registro</TableColumn>
              <TableColumn>Vencimento</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Na lixeira por</TableColumn>
              <TableColumn className="text-right">Ação</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Nenhuma licença na lixeira">
              {items.map((license) => {
                const status = normalizeLicenseStatus(license.status);
                return (
                  <TableRow key={license.id}>
                    <TableCell>
                      {LICENSE_TYPE_LABELS[normalizeLicenseType(license.license_type)]}
                    </TableCell>
                    <TableCell>{license.registration_number || "-"}</TableCell>
                    <TableCell>{formatDatePtBR(license.expiration_date)}</TableCell>
                    <TableCell>{LICENSE_STATUS_LABELS[status]}</TableCell>
                    <TableCell>{getTrashReason(status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<RotateCcw className="h-4 w-4" />}
                        onPress={() => onRestore(license)}
                        isLoading={restoringId === license.id}
                      >
                        Restaurar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

export function LicencasLixeira({
  clientLicenses,
  officeLicenses,
  canSeeOffice,
  isLoading,
  restoringId,
  onRefresh,
  onRestore,
}: LicencasLixeiraProps) {
  const [search, setSearch] = useState("");

  const filteredClients = useMemo(
    () => applySearch(clientLicenses, search),
    [clientLicenses, search],
  );
  const filteredOffice = useMemo(
    () => applySearch(officeLicenses, search),
    [officeLicenses, search],
  );

  return (
    <div className="space-y-4">
      <Card className="border border-default-200/60">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-danger">
            <Trash2 className="h-5 w-5" />
            <p className="font-medium">Lixeira de Licenças (excluídas e expiradas)</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar na lixeira..."
              startContent={<Search className="h-4 w-4 text-default-400" />}
              className="sm:min-w-[280px]"
            />
            <Button
              variant="flat"
              startContent={<RefreshCcw className="h-4 w-4" />}
              onPress={onRefresh}
              isLoading={isLoading}
            >
              Atualizar
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-4">
        <TrashTable
          title={`Clientes (${filteredClients.length})`}
          items={filteredClients}
          showCompany={canSeeOffice}
          restoringId={restoringId}
          onRestore={onRestore}
        />
        {canSeeOffice && (
          <TrashTable
            title={`Escritório (${filteredOffice.length})`}
            items={filteredOffice}
            showCompany={false}
            restoringId={restoringId}
            onRestore={onRestore}
          />
        )}
      </div>
    </div>
  );
}
