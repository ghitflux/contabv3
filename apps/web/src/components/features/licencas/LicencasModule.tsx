"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { pageTransition, fadeIn } from "@/lib/animations";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Input,
  Select,
  SelectItem,
  Spinner,
  Tab,
  Tabs,
  Textarea,
  useDisclosure,
} from "@/heroui";
import { LicenseCreateModal } from "./LicenseCreateModal";
import {
  License,
  LicenseCreate,
  LicenseRenewal,
  LicenseStatus,
  LicenseType,
  LICENSE_STATUS_LABELS,
  LICENSE_TYPE_LABELS,
  getLicenseStatusColor,
  normalizeLicenseStatus,
  normalizeLicenseType,
} from "@/types/license";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { AlertTriangle, Award, CheckCircle, Clock, Plus, Search, XCircle } from "lucide-react";

type TabKey = "clients" | "office";

const mockClientLicenses: License[] = [
  {
    id: "mock-client-1",
    client_id: "client-1",
    client_name: "Tech Solutions Ltda",
    license_type: LicenseType.LIC_SANITARIA,
    issuing_authority: "Vigilância Sanitária",
    registration_number: "LS-2023-001",
    issue_date: "2023-05-31",
    expiration_date: "2024-05-31",
    fee: 500,
    fee_paid: true,
    status: LicenseStatus.ACTIVE,
    notes: null,
  },
  {
    id: "mock-client-2",
    client_id: "client-2",
    client_name: "Indústria XYZ Ltda",
    license_type: LicenseType.AVCB_BOMBEIROS,
    issuing_authority: "Corpo de Bombeiros",
    registration_number: "AVCB-2022-102",
    issue_date: "2023-01-09",
    expiration_date: "2024-01-09",
    fee: 450,
    fee_paid: false,
    status: LicenseStatus.RENEWING,
    notes: null,
  },
  {
    id: "mock-client-3",
    client_id: "client-3",
    client_name: "Comércio ABC S.A.",
    license_type: LicenseType.LIC_AMBIENTAL,
    issuing_authority: "Secretaria Meio Ambiente",
    registration_number: "AMB-2021-808",
    issue_date: "2022-03-14",
    expiration_date: "2023-03-14",
    fee: 800,
    fee_paid: false,
    status: LicenseStatus.EXPIRED,
    notes: null,
  },
];

const mockOfficeLicenses: License[] = [
  {
    id: "mock-office-1",
    client_id: "office",
    client_name: "Contábil Consult",
    license_type: LicenseType.ALVARA_FUNC,
    issuing_authority: "Prefeitura de São Paulo",
    registration_number: "ALV-2023-550",
    issue_date: "2023-02-01",
    expiration_date: "2024-02-01",
    fee: 350,
    fee_paid: true,
    status: LicenseStatus.ACTIVE,
    notes: null,
  },
  {
    id: "mock-office-2",
    client_id: "office",
    client_name: "Contábil Consult",
    license_type: LicenseType.IE_ICMS,
    issuing_authority: "Secretaria da Fazenda",
    registration_number: "IE-2020-112",
    issue_date: "2020-06-20",
    expiration_date: "2025-06-20",
    fee: null,
    fee_paid: true,
    status: LicenseStatus.ACTIVE,
    notes: null,
  },
  {
    id: "mock-office-3",
    client_id: "office",
    client_name: "Contábil Consult",
    license_type: LicenseType.LIC_SANITARIA,
    issuing_authority: "Vigilância Sanitária",
    registration_number: "LS-2022-078",
    issue_date: "2022-09-10",
    expiration_date: "2024-09-10",
    fee: 260,
    fee_paid: false,
    status: LicenseStatus.PENDING,
    notes: null,
  },
];

function formatDatePtBR(dateString: string | null | undefined) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatCurrencyBRL(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getLicenseMeta(license: License) {
  const expiration = license.expiration_date ? new Date(license.expiration_date) : null;
  const today = new Date();
  let daysUntilExpiration: number | null = null;
  if (expiration) {
    const diffTime = expiration.getTime() - today.getTime();
    daysUntilExpiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const isExpired = daysUntilExpiration !== null && daysUntilExpiration < 0;
  const isExpiringSoon = daysUntilExpiration !== null && daysUntilExpiration >= 0 && daysUntilExpiration <= 30;

  return { daysUntilExpiration, isExpired, isExpiringSoon };
}

function getStatusIcon(status: LicenseStatus | string) {
  const normalized = normalizeLicenseStatus(status);
  switch (normalized) {
    case LicenseStatus.ACTIVE:
      return <CheckCircle className="h-4 w-4 text-success" />;
    case LicenseStatus.EXPIRED:
      return <XCircle className="h-4 w-4 text-danger" />;
    case LicenseStatus.RENEWING:
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    case LicenseStatus.PENDING:
      return <Clock className="h-4 w-4 text-warning" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-default-400" />;
  }
}

function filterMockLicenses(
  list: License[],
  search: string,
  typeFilter: string,
  statusFilter: string,
) {
  const query = search.trim().toLowerCase();

  return list.filter((license) => {
    const normalizedType = normalizeLicenseType(license.license_type);
    const normalizedStatus = normalizeLicenseStatus(license.status);
    const matchesSearch =
      !query ||
      (license.client_name ?? "").toLowerCase().includes(query) ||
      LICENSE_TYPE_LABELS[normalizedType].toLowerCase().includes(query);

    const matchesType =
      typeFilter === "all" || normalizedType === normalizeLicenseType(typeFilter as LicenseType);

    const matchesStatus =
      statusFilter === "all" || normalizedStatus === normalizeLicenseStatus(statusFilter as LicenseStatus);

    return matchesSearch && matchesType && matchesStatus;
  });
}

const OFFICE_CLIENT_ID = process.env.NEXT_PUBLIC_OFFICE_CLIENT_ID ?? null;

type LicenseListFilters = {
  query?: string;
  license_type?: LicenseType | string;
  status?: LicenseStatus | string;
  expiring_soon?: boolean;
  expired?: boolean;
  page?: number;
  size?: number;
};

export function LicencasModule() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [filters, setFilters] = useState<LicenseListFilters>({ page: 1, size: 10 });
  const [licensesData, setLicensesData] = useState<{ items: License[]; total: number; page: number; size: number } | null>(null);
  const [licensesLoading, setLicensesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("clients");
  const [cardSearch, setCardSearch] = useState("");
  const [cardTypeFilter, setCardTypeFilter] = useState<string>("all");
  const [cardStatusFilter, setCardStatusFilter] = useState<string>("all");

  const filteredClientLicenses = useMemo(
    () => filterMockLicenses(mockClientLicenses, cardSearch, cardTypeFilter, cardStatusFilter),
    [cardSearch, cardStatusFilter, cardTypeFilter],
  );

  const filteredOfficeLicenses = useMemo(
     () => filterMockLicenses(mockOfficeLicenses, cardSearch, cardTypeFilter, cardStatusFilter),
     [cardSearch, cardStatusFilter, cardTypeFilter],
   );

  const cardTypeItems = useMemo(
    () => [
      { key: "all", label: "Todos os tipos" },
      ...Array.from(new Set(Object.values(LicenseType))).map((type) => ({
        key: type,
        label: LICENSE_TYPE_LABELS[normalizeLicenseType(type)],
      })),
    ],
    [],
  );

  const cardStatusItems = useMemo(
    () => [
      { key: "all", label: "Todos os status" },
      ...Array.from(new Set(Object.values(LicenseStatus))).map((status) => ({
        key: status,
        label: LICENSE_STATUS_LABELS[normalizeLicenseStatus(status)],
      })),
    ],
    [],
  );

  const {
    isOpen: isDetailsOpen,
    onOpen: onDetailsOpen,
    onClose: onDetailsClose,
  } = useDisclosure();
  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onClose: onEditClose,
  } = useDisclosure();
  const {
    isOpen: isRenewOpen,
    onOpen: onRenewOpen,
    onClose: onRenewClose,
  } = useDisclosure();
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();

  const [formData, setFormData] = useState<LicenseCreate>({
    client_id: "",
    license_type: LicenseType.ALVARA_FUNC,
    registration_number: "",
    issuing_authority: "",
    issue_date: new Date().toISOString().split("T")[0]!,
    expiration_date: null,
    notes: null,
  });

  const [renewalData, setRenewalData] = useState<LicenseRenewal>({
    new_issue_date: new Date().toISOString().split("T")[0]!,
    new_expiration_date: null,
    new_registration_number: null,
    notes: null,
  });

  const { clients, isLoading: clientsLoading, fetchClients: fetchClientsData } = useClients();

  useEffect(() => {
    fetchClientsData({ size: 100 });
  }, [fetchClientsData]);

  const fetchLicenses = useCallback(
    async (override?: Partial<LicenseListFilters & { client_id: string }>) => {
      const clientId = override?.client_id ?? selectedClientId;
      if (!clientId) {
        setLicensesData(null);
        return;
      }

      setLicensesLoading(true);
      setError(null);

      try {
        const response = await licensesApi.list({
          query: override?.query ?? filters.query,
          license_type: override?.license_type ?? filters.license_type,
          status: override?.status ?? filters.status,
          client_id: clientId,
          page: override?.page ?? filters.page ?? 1,
          size: override?.size ?? filters.size ?? 10,
          expiring_soon: override?.expiring_soon ?? filters.expiring_soon,
          expired: override?.expired ?? filters.expired,
        });

        setLicensesData({
          items: response.items ?? [],
          total: response.total ?? 0,
          page: response.page ?? 1,
          size: response.size ?? 10,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar licenças.";
        setError(message);
        console.error(err);
      } finally {
        setLicensesLoading(false);
      }
    },
    [filters, selectedClientId]
  );

  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  const summaryFilters = useMemo(
    () => ({
      license_type: filters.license_type,
      status: filters.status,
      expiring_soon: filters.expiring_soon,
      expired: filters.expired,
      query: filters.query,
    }),
    [filters]
  );

  const handleFilterChange = (nextFilters: LicenseListFilters) => {
    setFilters((prev) => ({
      ...prev,
      ...nextFilters,
      page: 1,
    }));
  };

  const handleViewDetails = async (license: License) => {
    try {
      const data = await licensesApi.get(license.id);
      setSelectedLicense(data);
    } catch (err) {
      console.error(err);
      setSelectedLicense(license);
    }
    onDetailsOpen();
  };

  const handleCreateSubmit = async (payload: any) => {
    await licensesApi.create(payload);
    setIsCreateOpen(false);
    await fetchLicenses();
    setRefreshKey((prev) => prev + 1);
  };

  const handleEdit = (license: License) => {
    setSelectedLicense(license);
    setFormData({
      client_id: license.client_id,
      license_type: normalizeLicenseType(license.license_type),
      registration_number: license.registration_number,
      issuing_authority: license.issuing_authority,
      issue_date: license.issue_date,
      expiration_date: license.expiration_date,
      notes: license.notes ?? null,
    });
    onEditOpen();
  };

  const handleEditSubmit = async () => {
    if (!selectedLicense) return;
    try {
      await licensesApi.update(selectedLicense.id, {
        license_type: formData.license_type,
        registration_number: formData.registration_number,
        issuing_authority: formData.issuing_authority,
        issue_date: formData.issue_date,
        expiration_date: formData.expiration_date,
        notes: formData.notes,
      });
      onEditClose();
      await fetchLicenses();
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      alert("Não foi possível atualizar a licença.");
    }
  };

  const handleRenew = (license: License) => {
    setSelectedLicense(license);
    setRenewalData({
      new_issue_date: new Date().toISOString().split("T")[0]!,
      new_expiration_date: null,
      new_registration_number: null,
      notes: null,
    });
    onRenewOpen();
  };

  const handleRenewSubmit = async () => {
    if (!selectedLicense) return;
    try {
      await licensesApi.renew(selectedLicense.id, renewalData);
      onRenewClose();
      await fetchLicenses();
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      alert("Não foi possível renovar a licença.");
    }
  };

  const handleDelete = (license: License) => {
    setSelectedLicense(license);
    onDeleteOpen();
  };

  const handleDeleteSubmit = async () => {
    if (!selectedLicense) return;
    try {
      await licensesApi.delete(selectedLicense.id);
      onDeleteClose();
      await fetchLicenses();
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      alert("Não foi possível excluir a licença.");
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
      className="space-y-6"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Licenças e Certificações</h1>
          <p className="text-default-500 mt-1">Visualize rapidamente as licenças mockadas por cliente ou escritório</p>
        </div>
        <Button color="primary" onPress={() => setIsCreateOpen(true)} startContent={<Plus className="h-4 w-4" />}>
          Nova licença
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <Input
          className="lg:flex-1"
          placeholder="Buscar por cliente ou tipo de licença..."
          value={cardSearch}
          onChange={(event) => setCardSearch(event.target.value)}
          startContent={<Search className="h-4 w-4 text-default-400" />}
        />
        <Select
          className="w-full lg:w-56"
          selectedKeys={[cardTypeFilter]}
          onSelectionChange={(keys) => setCardTypeFilter(Array.from(keys)[0] as string)}
          items={cardTypeItems}
          aria-label="Filtrar por tipo de licença"
        >
          {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
        </Select>
        <Select
          className="w-full lg:w-48"
          selectedKeys={[cardStatusFilter]}
          onSelectionChange={(keys) => setCardStatusFilter(Array.from(keys)[0] as string)}
          items={cardStatusItems}
          aria-label="Filtrar por status de licença"
        >
          {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
        </Select>
      </div>

      <Card>
        <CardBody>
          <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as TabKey)} color="primary">
            <Tab key="clients" title={`Licenças de Clientes (${filteredClientLicenses.length})`}>
              <motion.div
                key="clients"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={fadeIn}
              >
                <LicenseCardGrid licenses={filteredClientLicenses} />
              </motion.div>
            </Tab>
            <Tab key="office" title={`Licenças do Escritório (${filteredOfficeLicenses.length})`}>
              <motion.div
                key="office"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={fadeIn}
              >
                <LicenseCardGrid licenses={filteredOfficeLicenses} />
              </motion.div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      <LicenseCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateSubmit}
        defaultClientId={OFFICE_CLIENT_ID}
        selectedClientId={selectedClientId}
      />

      <Modal isOpen={isDetailsOpen} onClose={onDetailsClose} size="3xl">
        <ModalContent>
          <ModalHeader>Detalhes da Licença</ModalHeader>
          <ModalBody>
            {selectedLicense && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-default-500">Cliente</p>
                    <p className="font-semibold">
                      {selectedLicense.client_name || selectedLicense.client_id}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-default-500">Tipo</p>
                    <p className="font-semibold">
                      {LICENSE_TYPE_LABELS[normalizeLicenseType(selectedLicense.license_type)]}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-default-500">Número de Registro</p>
                    <p className="font-semibold font-mono">
                      {selectedLicense.registration_number}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-default-500">Órgão Emissor</p>
                    <p className="font-semibold">{selectedLicense.issuing_authority}</p>
                  </div>
                  <div>
                    <p className="text-sm text-default-500">Data de Emissão</p>
                    <p className="font-semibold">{formatDatePtBR(selectedLicense.issue_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-default-500">Data de Vencimento</p>
                    <p className="font-semibold">{formatDatePtBR(selectedLicense.expiration_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-default-500">Status</p>
                    <Chip
                      color={getLicenseStatusColor(selectedLicense.status) as any}
                      size="sm"
                      variant="flat"
                    >
                      {LICENSE_STATUS_LABELS[normalizeLicenseStatus(selectedLicense.status)]}
                    </Chip>
                  </div>
                  {selectedLicense.notes && (
                    <div className="col-span-2">
                      <p className="text-sm text-default-500">Notas</p>
                      <p className="font-semibold">{selectedLicense.notes}</p>
                    </div>
                  )}
                </div>

                <Divider />

                <LicenseTimeline licenseId={selectedLicense.id} />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onDetailsClose}>
              Fechar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={onEditClose} size="2xl">
        <ModalContent>
          <ModalHeader>Editar Licença</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Select
                label="Tipo de Licença"
                selectedKeys={[formData.license_type]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as LicenseType;
                  if (selected) {
                    setFormData({ ...formData, license_type: selected });
                  }
                }}
              >
                {Object.values(LicenseType).map((type) => (
                  <SelectItem key={type}>{LICENSE_TYPE_LABELS[type]}</SelectItem>
                ))}
              </Select>
              <InputField
                label="Número de Registro"
                value={formData.registration_number}
                onChange={(value) => setFormData({ ...formData, registration_number: value })}
              />
              <InputField
                label="Órgão Emissor"
                value={formData.issuing_authority}
                onChange={(value) => setFormData({ ...formData, issuing_authority: value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <DatePickerField
                  label="Data de Emissão"
                  value={formData.issue_date}
                  onChange={(value) => setFormData({ ...formData, issue_date: value })}
                />
                <DatePickerField
                  label="Data de Vencimento (opcional)"
                  value={formData.expiration_date}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      expiration_date: value || null,
                    })
                  }
                  isClearable
                />
              </div>
              <Textarea
                label="Notas (opcional)"
                value={formData.notes || ""}
                onChange={(event) =>
                  setFormData({ ...formData, notes: event.target.value || null })
                }
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onEditClose}>
              Cancelar
            </Button>
            <Button
              color="primary"
              onPress={handleEditSubmit}
              isDisabled={!formData.registration_number || !formData.issuing_authority}
            >
              Salvar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isRenewOpen} onClose={onRenewClose} size="2xl">
        <ModalContent>
          <ModalHeader>Renovar Licença</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <DatePickerField
                label="Nova Data de Emissão"
                value={renewalData.new_issue_date}
                onChange={(value) =>
                  setRenewalData({ ...renewalData, new_issue_date: value })
                }
              />
              <DatePickerField
                label="Nova Data de Vencimento (opcional)"
                value={renewalData.new_expiration_date}
                onChange={(value) =>
                  setRenewalData({
                    ...renewalData,
                    new_expiration_date: value || null,
                  })
                }
                isClearable
              />
              <InputField
                label="Novo Número de Registro (opcional)"
                value={renewalData.new_registration_number || ""}
                onChange={(value) =>
                  setRenewalData({
                    ...renewalData,
                    new_registration_number: value || null,
                  })
                }
              />
              <Textarea
                label="Notas de Renovação (opcional)"
                value={renewalData.notes || ""}
                onChange={(event) =>
                  setRenewalData({ ...renewalData, notes: event.target.value || null })
                }
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onRenewClose}>
              Cancelar
            </Button>
            <Button color="success" onPress={handleRenewSubmit}>
              Renovar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalContent>
          <ModalHeader>Excluir Licença</ModalHeader>
          <ModalBody>
            <p>
              Tem certeza que deseja excluir esta licença? Esta ação não pode ser desfeita.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onDeleteClose}>
              Cancelar
            </Button>
            <Button color="danger" onPress={handleDeleteSubmit}>
              Excluir
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}

function LicenseCardGrid({ licenses }: { licenses: License[] }) {
  if (!licenses.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-medium border border-dashed border-default-200 text-default-400">
        Nenhuma licença encontrada com os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {licenses.map((license) => (
        <LicenseCard key={license.id} license={license} />
      ))}
    </div>
  );
}

function LicenseCard({ license }: { license: License }) {
  const { daysUntilExpiration, isExpired, isExpiringSoon } = getLicenseMeta(license);
  const status = normalizeLicenseStatus(license.status);
  const statusLabel = LICENSE_STATUS_LABELS[status];
  const statusColor = getLicenseStatusColor(status) as any;
  const highlightClass = isExpired
    ? "border border-red-200"
    : isExpiringSoon
      ? "border border-amber-200"
      : "border border-transparent";

  const feePaid = license.fee_paid ?? false;

  return (
    <Card className={`shadow-sm ${highlightClass}`}>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 text-teal-500">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                {LICENSE_TYPE_LABELS[normalizeLicenseType(license.license_type)]}
              </h3>
              <p className="text-sm text-default-500">{license.client_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            <Chip size="sm" color={statusColor} variant="flat">
              {statusLabel}
            </Chip>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-default-500">Emissão:</span>
            <span className="font-medium">{formatDatePtBR(license.issue_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-default-500">Vencimento:</span>
            <span
              className={`font-medium ${isExpired ? "text-danger" : isExpiringSoon ? "text-warning" : ""}`}
            >
              {formatDatePtBR(license.expiration_date)}
            </span>
          </div>

          {(isExpired || isExpiringSoon) && daysUntilExpiration !== null && (
            <div
              className={`flex items-center gap-2 rounded-medium border px-3 py-2 text-xs font-medium ${isExpired ? "border-red-100 bg-red-50 text-danger" : "border-amber-100 bg-amber-50 text-warning"}`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>
                {isExpired
                  ? `Venceu há ${Math.abs(daysUntilExpiration)} dias`
                  : `Vence em ${daysUntilExpiration} dias`}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-default-500">Taxa:</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{formatCurrencyBRL(license.fee ?? null)}</span>
              <Chip
                size="sm"
                variant="flat"
                color={feePaid ? "success" : "danger"}
                className="uppercase"
              >
                {feePaid ? "Paga" : "Pendente"}
              </Chip>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button className="flex-1" variant="flat">
            Ver Detalhes
          </Button>
          <Button className="flex-1" color="primary">
            Renovar
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

