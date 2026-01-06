"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { pageTransition, fadeIn } from "@/lib/animations";
import {
  Button,
  Card,
  CardBody,
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
import { LicenseTimeline } from "./LicenseTimeline";
import {
  License,
  LicenseCreate,
  LicenseRenewal,
  LicenseStatus,
  LicenseType,
  LicenseFilters,
  LICENSE_STATUS_LABELS,
  LICENSE_TYPE_LABELS,
  getLicenseStatusColor,
  getExpirationBadgeColor,
  formatExpirationStatus,
  normalizeLicenseStatus,
  normalizeLicenseType,
} from "@/types/license";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { AlertTriangle, Award, CheckCircle, Clock, Eye, Plus, RefreshCcw, Search, Trash2, XCircle } from "lucide-react";
import { useLicenses } from "@/hooks/useLicenses";
import { clientsApi } from "@/lib/api/endpoints/clients";
import { toast } from "@/lib/toast";

type TabKey = "clients" | "office";

const DEFAULT_PAGE_SIZE = 50;

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
  const hasServerInfo =
    license.days_until_expiration !== undefined &&
    license.days_until_expiration !== null;

  const expiration = license.expiration_date ? new Date(license.expiration_date) : null;
  const today = new Date();
  const computedDays = expiration ? Math.ceil((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const daysUntilExpiration = hasServerInfo ? license.days_until_expiration! : computedDays;

  const isExpired =
    license.is_expired ??
    (daysUntilExpiration !== null && daysUntilExpiration < 0);
  const isExpiringSoon =
    license.is_expiring_soon ??
    (daysUntilExpiration !== null && daysUntilExpiration >= 0 && daysUntilExpiration <= 30);

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

function formatClientLabel(license: License, officeClientId?: string | null) {
  if (license.client_name) return license.client_name;
  if (officeClientId && license.client_id === officeClientId) return "Escritório";
  if (license.client_id) return `Cliente ${license.client_id.slice(0, 8)}`;
  return "Cliente";
}

const OFFICE_CLIENT_ID = process.env.NEXT_PUBLIC_OFFICE_CLIENT_ID ?? null;

export function LicencasModule() {
  const {
    licenses,
    selectedLicense,
    isLoading,
    fetchLicenses,
    fetchLicenseById,
    createLicense,
    updateLicense,
    deleteLicense,
    renewLicense,
    setSelectedLicense,
  } = useLicenses();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("clients");
  const [cardSearch, setCardSearch] = useState("");
  const [cardTypeFilter, setCardTypeFilter] = useState<string>("all");
  const [cardStatusFilter, setCardStatusFilter] = useState<string>("all");
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
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

  useEffect(() => {
    const filters: LicenseFilters = {
      search: cardSearch || undefined,
      license_type: cardTypeFilter !== "all" ? cardTypeFilter : undefined,
      status: cardStatusFilter !== "all" ? cardStatusFilter : undefined,
      page: 1,
      size: DEFAULT_PAGE_SIZE,
    };

    const timer = setTimeout(() => {
      fetchLicenses(filters);
    }, 300);

    return () => clearTimeout(timer);
  }, [cardSearch, cardStatusFilter, cardTypeFilter, fetchLicenses, refreshKey]);

  const licensesList = licenses?.items ?? [];
  const officeClientId = OFFICE_CLIENT_ID;

  useEffect(() => {
    const uniqueIds = Array.from(new Set(licensesList.map((license) => license.client_id).filter(Boolean)));
    const idsToFetch = uniqueIds.filter((id) => !clientNames[id]);

    if (!idsToFetch.length) return;

    const fetchClientNames = async () => {
      const updates: Record<string, string> = {};
      for (const id of idsToFetch) {
        try {
          const client = await clientsApi.getById(id);
          updates[id] = client.nome_fantasia || client.razao_social || `Cliente ${id.slice(0, 8)}`;
        } catch (error) {
          updates[id] = `Cliente ${id.slice(0, 8)}`;
        }
      }
      if (Object.keys(updates).length) {
        setClientNames((prev) => ({ ...prev, ...updates }));
      }
    };

    fetchClientNames();
  }, [licensesList, clientNames]);

  const licensesWithNames = useMemo(
    () =>
      licensesList.map((license) => ({
        ...license,
        client_name: license.client_name ?? clientNames[license.client_id],
      })),
    [licensesList, clientNames],
  );

  const clientLicenses = useMemo(() => {
    if (!officeClientId) return licensesWithNames;
    return licensesWithNames.filter((license) => license.client_id !== officeClientId);
  }, [licensesWithNames, officeClientId]);

  const officeLicenses = useMemo(() => {
    if (!officeClientId) return [];
    return licensesWithNames.filter((license) => license.client_id === officeClientId);
  }, [licensesWithNames, officeClientId]);

  const handleViewDetails = async (license: License) => {
    try {
      const data = await fetchLicenseById(license.id);
      setSelectedLicense(data ?? license);
    } catch (err) {
      console.error(err);
      setSelectedLicense(license);
    }
    onDetailsOpen();
  };

  const handleCreateSubmit = async (payload: any) => {
    try {
      await createLicense(payload as LicenseCreate);
      toast.success("Licença criada com sucesso.");
      setIsCreateOpen(false);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível criar a licença.");
    }
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
      await updateLicense(selectedLicense.id, {
        license_type: formData.license_type,
        registration_number: formData.registration_number,
        issuing_authority: formData.issuing_authority,
        issue_date: formData.issue_date,
        expiration_date: formData.expiration_date,
        notes: formData.notes,
      });
      onEditClose();
      setRefreshKey((prev) => prev + 1);
      toast.success("Licença atualizada com sucesso.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível atualizar a licença.");
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
    if (!renewalData.new_issue_date) {
      toast.error("Informe a nova data de emissão.");
      return;
    }
    try {
      await renewLicense(selectedLicense.id, renewalData);
      onRenewClose();
      setRefreshKey((prev) => prev + 1);
      toast.success("Licença renovada com sucesso.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível renovar a licença.");
    }
  };

  const handleDelete = (license: License) => {
    setSelectedLicense(license);
    onDeleteOpen();
  };

  const handleDeleteSubmit = async () => {
    if (!selectedLicense) return;
    try {
      await deleteLicense(selectedLicense.id);
      onDeleteClose();
      onDetailsClose();
      setRefreshKey((prev) => prev + 1);
      setSelectedLicense(null);
      toast.success("Licença excluída com sucesso.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível excluir a licença.");
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
          <p className="text-default-500 mt-1">Visualize rapidamente as licenças emitidas para clientes ou para o escritório.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="flat"
            startContent={<RefreshCcw className="h-4 w-4" />}
            onPress={() => setRefreshKey((prev) => prev + 1)}
          >
            Atualizar
          </Button>
          <Button color="primary" onPress={() => setIsCreateOpen(true)} startContent={<Plus className="h-4 w-4" />}>
            Nova licença
          </Button>
        </div>
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
            <Tab key="clients" title={`Licenças de Clientes (${clientLicenses.length})`}>
              <motion.div
                key="clients"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={fadeIn}
              >
                <LicenseCardGrid
                  licenses={clientLicenses}
                  officeClientId={officeClientId}
                  onViewDetails={handleViewDetails}
                  onRenew={handleRenew}
                  onDelete={handleDelete}
                  isLoading={isLoading}
                  emptyMessage="Nenhuma licença encontrada para os filtros selecionados."
                />
              </motion.div>
            </Tab>
            <Tab key="office" title={`Licenças do Escritório (${officeLicenses.length})`}>
              <motion.div
                key="office"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={fadeIn}
              >
                <LicenseCardGrid
                  licenses={officeLicenses}
                  officeClientId={officeClientId}
                  onViewDetails={handleViewDetails}
                  onRenew={handleRenew}
                  onDelete={handleDelete}
                  isLoading={isLoading}
                  emptyMessage={
                    officeClientId
                      ? "Nenhuma licença do escritório encontrada."
                      : "Informe NEXT_PUBLIC_OFFICE_CLIENT_ID para listar as licenças do escritório."
                  }
                />
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
        selectedClientId=""
      />

      <Modal
        isOpen={isDetailsOpen}
        onClose={() => {
          setSelectedLicense(null);
          onDetailsClose();
        }}
        size="3xl"
      >
        <ModalContent>
          <ModalHeader>Detalhes da Licença</ModalHeader>
          <ModalBody>
            {selectedLicense && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-default-500">Cliente</p>
                    <p className="font-semibold">
                      {formatClientLabel(selectedLicense, officeClientId)}
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
                  <div>
                    <p className="text-sm text-default-500">Validade</p>
                    <Chip size="sm" variant="flat" color={getExpirationBadgeColor(selectedLicense)}>
                      {formatExpirationStatus(selectedLicense)}
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
            <div className="flex w-full items-center justify-between gap-3">
              <Button variant="light" onPress={() => { setSelectedLicense(null); onDetailsClose(); }}>
                Fechar
              </Button>
              {selectedLicense && (
                <div className="flex items-center gap-2">
                  <Button variant="flat" color="primary" onPress={() => { handleRenew(selectedLicense); onDetailsClose(); }}>
                    Renovar
                  </Button>
                  <Button variant="light" color="danger" onPress={() => { handleDelete(selectedLicense); onDetailsClose(); }}>
                    Excluir
                  </Button>
                </div>
              )}
            </div>
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

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => {
          onDeleteClose();
          setSelectedLicense(null);
        }}
      >
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

function LicenseCardGrid({
  licenses,
  officeClientId,
  onViewDetails,
  onRenew,
  onDelete,
  isLoading,
  emptyMessage,
}: {
  licenses: License[];
  officeClientId?: string | null;
  onViewDetails: (license: License) => void;
  onRenew: (license: License) => void;
  onDelete: (license: License) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}) {
  if (isLoading && !licenses.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-medium border border-default-200">
        <Spinner size="sm" color="primary" />
      </div>
    );
  }

  if (!licenses.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-medium border border-dashed border-default-200 text-default-400">
        {emptyMessage ?? "Nenhuma licença encontrada com os filtros selecionados."}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {licenses.map((license) => (
        <LicenseCard
          key={license.id}
          license={license}
          officeClientId={officeClientId}
          onViewDetails={onViewDetails}
          onRenew={onRenew}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function LicenseCard({
  license,
  officeClientId,
  onViewDetails,
  onRenew,
  onDelete,
}: {
  license: License;
  officeClientId?: string | null;
  onViewDetails?: (license: License) => void;
  onRenew?: (license: License) => void;
  onDelete?: (license: License) => void;
}) {
  const { daysUntilExpiration, isExpired, isExpiringSoon } = getLicenseMeta(license);
  const status = normalizeLicenseStatus(license.status);
  const statusLabel = LICENSE_STATUS_LABELS[status];
  const statusColor = getLicenseStatusColor(status) as any;
  const expirationColor = getExpirationBadgeColor(license);
  const expirationLabel = formatExpirationStatus(license);
  const feePaid = license.fee_paid ?? false;
  const isOffice = officeClientId && license.client_id === officeClientId;

  const accentBar =
    status === LicenseStatus.ACTIVE
      ? "from-emerald-500/60 via-emerald-400/30 to-emerald-300/10"
      : status === LicenseStatus.RENEWING
        ? "from-amber-400/60 via-amber-300/40 to-amber-200/20"
        : status === LicenseStatus.EXPIRED
          ? "from-rose-500/70 via-rose-400/40 to-rose-300/20"
          : "from-slate-500/50 via-slate-400/30 to-slate-300/10";

  const highlightClass = isExpired
    ? "border border-danger-200/70"
    : isExpiringSoon
      ? "border border-warning-200/70"
      : "border border-default-100";

  return (
    <Card className={`relative overflow-hidden bg-content1/80 shadow-medium backdrop-blur ${highlightClass}`}>
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentBar}`} />
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 text-teal-500 ring-4 ring-teal-100/60">
              <Award className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold leading-tight">
                  {LICENSE_TYPE_LABELS[normalizeLicenseType(license.license_type)]}
                </h3>
                <Chip size="sm" variant="flat" color={expirationColor} className="capitalize">
                  {expirationLabel}
                </Chip>
              </div>
              <div className="flex items-center gap-2 text-sm text-default-500">
                <span className="font-medium text-default-600">
                  {formatClientLabel(license, officeClientId)}
                </span>
                {isOffice && (
                  <Chip size="sm" variant="flat" color="secondary">
                    Escritório
                  </Chip>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            <Chip size="sm" color={statusColor} variant="flat">
              {statusLabel}
            </Chip>
            {onDelete && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                aria-label="Excluir licença"
                onPress={() => onDelete(license)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col gap-1 rounded-medium bg-default-50/70 p-3">
            <span className="text-default-500">Emissão</span>
            <span className="font-semibold">{formatDatePtBR(license.issue_date)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-medium bg-default-50/70 p-3">
            <span className="text-default-500">Vencimento</span>
            <span className={`font-semibold ${isExpired ? "text-danger" : isExpiringSoon ? "text-warning" : ""}`}>
              {formatDatePtBR(license.expiration_date)}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-medium bg-default-50/70 p-3">
            <span className="text-default-500">Registro</span>
            <span className="font-mono text-sm font-semibold text-default-700">
              {license.registration_number || "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-medium bg-default-50/70 p-3">
            <span className="text-default-500">Órgão emissor</span>
            <span className="font-semibold truncate" title={license.issuing_authority}>
              {license.issuing_authority || "—"}
            </span>
          </div>
        </div>

        {(isExpired || isExpiringSoon) && daysUntilExpiration !== null && (
          <div
            className={`flex items-center gap-2 rounded-medium border px-3 py-2 text-xs font-medium ${isExpired ? "border-danger-100 bg-danger-50 text-danger" : "border-warning-100 bg-warning-50 text-warning"}`}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>
              {isExpired
                ? `Venceu há ${Math.abs(daysUntilExpiration)} dias`
                : `Vence em ${daysUntilExpiration} dias`}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between rounded-medium border border-default-100 px-3 py-2">
          <div className="flex items-center gap-2 text-default-500">
            <Clock className="h-4 w-4" />
            <span>Taxa</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{formatCurrencyBRL(license.fee ?? null)}</span>
            <Chip
              size="sm"
              variant="flat"
              color={feePaid ? "success" : "warning"}
              className="uppercase"
            >
              {feePaid ? "Paga" : "Pendente"}
            </Chip>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            className="flex-1"
            variant="flat"
            startContent={<Eye className="h-4 w-4" />}
            onPress={() => onViewDetails?.(license)}
          >
            Ver Detalhes
          </Button>
          <Button
            className="flex-1"
            color="primary"
            startContent={<RefreshCcw className="h-4 w-4" />}
            onPress={() => onRenew?.(license)}
          >
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
