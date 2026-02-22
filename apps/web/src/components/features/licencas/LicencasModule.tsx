"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { LicencasHistorico } from "./LicencasHistorico";
import { LicencasLixeira } from "./LicencasLixeira";
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
  SUMMARY_LICENSE_TYPES,
  getLicenseStatusColor,
  getExpirationBadgeColor,
  formatExpirationStatus,
  normalizeLicenseStatus,
  normalizeLicenseType,
} from "@/types/license";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { Eye, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import { useLicenses } from "@/hooks/useLicenses";
import { useAuth } from "@/hooks/auth/AuthContext";
import { licensesApi } from "@/lib/api/licenses";
import { toast } from "@/lib/toast";

type TabKey = "clients" | "office" | "history" | "trash";

const DEFAULT_PAGE_SIZE = 100;
const ACTIVE_STATUS_FILTERS: LicenseStatus[] = [
  LicenseStatus.ACTIVE,
  LicenseStatus.PENDING,
  LicenseStatus.RENEWING,
  LicenseStatus.SUSPENDED,
];
const MATRIX_LICENSE_TYPES: LicenseType[] = Array.from(
  new Set([
    ...SUMMARY_LICENSE_TYPES,
    LicenseType.INSCRICAO_MUNICIPAL,
    LicenseType.CERTIFICADO_DIGITAL,
  ]),
);

function formatDatePtBR(dateString: string | null | undefined) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatClientLabel(license: License, officeClientId?: string | null) {
  if (license.client_name) return license.client_name;
  if (officeClientId && license.client_id === officeClientId) return "Escritório";
  if (license.client_id) return `Cliente ${license.client_id.slice(0, 8)}`;
  return "Cliente";
}

const OFFICE_CLIENT_ID = process.env.NEXT_PUBLIC_OFFICE_CLIENT_ID ?? null;

export function LicencasModule() {
  const { user } = useAuth();
  const isAdminOrFunc = user?.role !== "cliente";
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
    restoreLicense,
    setSelectedLicense,
  } = useLicenses();

  const availableTabs = useMemo<TabKey[]>(
    () => (isAdminOrFunc ? ["clients", "office", "history", "trash"] : ["clients", "history", "trash"]),
    [isAdminOrFunc],
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>(availableTabs[0] ?? "clients");
  const [cardSearch, setCardSearch] = useState("");
  const [cardTypeFilter, setCardTypeFilter] = useState<string>("all");
  const [cardStatusFilter, setCardStatusFilter] = useState<string>("all");
  const [trashLicenses, setTrashLicenses] = useState<License[]>([]);
  const [isTrashLoading, setIsTrashLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] ?? "clients");
    }
  }, [activeTab, availableTabs]);

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
      ...ACTIVE_STATUS_FILTERS.map((status) => ({
        key: status,
        label: LICENSE_STATUS_LABELS[normalizeLicenseStatus(status)],
      })),
    ],
    [],
  );

  useEffect(() => {
    if (activeTab === "history" || activeTab === "trash") return;

    const filters: LicenseFilters = {
      search: cardSearch || undefined,
      license_type: cardTypeFilter !== "all" ? cardTypeFilter : undefined,
      status: cardStatusFilter !== "all" ? cardStatusFilter : undefined,
      include_deleted: false,
      deleted_only: false,
      page: 1,
      size: DEFAULT_PAGE_SIZE,
    };

    const timer = setTimeout(() => {
      fetchLicenses(filters);
    }, 300);

    return () => clearTimeout(timer);
  }, [activeTab, cardSearch, cardStatusFilter, cardTypeFilter, fetchLicenses, refreshKey]);

  const licensesList = licenses?.items ?? [];
  const officeClientId = OFFICE_CLIENT_ID;

  const licensesWithNames = useMemo(
    () =>
      licensesList.map((license) => ({
        ...license,
        client_name: formatClientLabel(license, officeClientId),
      })),
    [licensesList, officeClientId],
  );

  const clientLicenses = useMemo(() => {
    if (!officeClientId) return licensesWithNames;
    return licensesWithNames.filter((license) => license.client_id !== officeClientId);
  }, [licensesWithNames, officeClientId]);

  const officeLicenses = useMemo(() => {
    if (!officeClientId) return [];
    return licensesWithNames.filter((license) => license.client_id === officeClientId);
  }, [licensesWithNames, officeClientId]);

  const loadTrashLicenses = useCallback(async () => {
    setIsTrashLoading(true);
    try {
      const response = await licensesApi.list({
        include_deleted: true,
        deleted_only: true,
        page: 1,
        size: 100,
      });
      const items = (response.items ?? []).map((license) => ({
        ...license,
        client_name: formatClientLabel(license, officeClientId),
      }));
      setTrashLicenses(items);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar a lixeira de licenças.");
    } finally {
      setIsTrashLoading(false);
    }
  }, [officeClientId]);

  useEffect(() => {
    if (activeTab !== "trash") return;
    void loadTrashLicenses();
  }, [activeTab, loadTrashLicenses, refreshKey]);

  const trashClientLicenses = useMemo(() => {
    if (!officeClientId || !isAdminOrFunc) return trashLicenses;
    return trashLicenses.filter((license) => license.client_id !== officeClientId);
  }, [trashLicenses, officeClientId, isAdminOrFunc]);

  const trashOfficeLicenses = useMemo(() => {
    if (!officeClientId) return [];
    return trashLicenses.filter((license) => license.client_id === officeClientId);
  }, [trashLicenses, officeClientId]);

  const normalizedSearch = cardSearch.trim().toLowerCase();

  const filterLicenseItems = useMemo(() => {
    return (items: License[]) =>
      items.filter((license) => {
        const type = normalizeLicenseType(license.license_type);
        const status = normalizeLicenseStatus(license.status);
        const companyName = (license.client_name || "").toLowerCase();
        const typeLabel = LICENSE_TYPE_LABELS[type].toLowerCase();
        const statusLabel = LICENSE_STATUS_LABELS[status].toLowerCase();
        const registration = (license.registration_number || "").toLowerCase();
        const authority = (license.issuing_authority || "").toLowerCase();

        const matchesType =
          cardTypeFilter === "all" || type === (cardTypeFilter as LicenseType);
        const matchesStatus =
          cardStatusFilter === "all" || status === (cardStatusFilter as LicenseStatus);
        const matchesSearch =
          !normalizedSearch ||
          companyName.includes(normalizedSearch) ||
          typeLabel.includes(normalizedSearch) ||
          statusLabel.includes(normalizedSearch) ||
          registration.includes(normalizedSearch) ||
          authority.includes(normalizedSearch);

        return matchesType && matchesStatus && matchesSearch;
      });
  }, [cardStatusFilter, cardTypeFilter, normalizedSearch]);

  const filteredClientLicenses = useMemo(
    () => filterLicenseItems(clientLicenses),
    [clientLicenses, filterLicenseItems],
  );

  const filteredOfficeLicenses = useMemo(
    () => filterLicenseItems(officeLicenses),
    [officeLicenses, filterLicenseItems],
  );

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

  const handleRestoreFromTrash = async (license: License) => {
    try {
      setRestoringId(license.id);
      await restoreLicense(license.id);
      toast.success("Licença restaurada com sucesso.");
      await loadTrashLicenses();
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      toast.error(
        typeof detail === "string"
          ? detail
          : "Não foi possível restaurar a licença.",
      );
    } finally {
      setRestoringId(null);
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
          {isAdminOrFunc && (
            <Button color="primary" onPress={() => setIsCreateOpen(true)} startContent={<Plus className="h-4 w-4" />}>
              Nova licença
            </Button>
          )}
        </div>
      </div>

      {(activeTab === "clients" || activeTab === "office") && (
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
      )}

      <Card>
        <CardBody>
          <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as TabKey)} color="primary">
            <Tab
              key="clients"
              title={
                isAdminOrFunc
                  ? `Licenças de Clientes (${filteredClientLicenses.length})`
                  : `Minhas Licenças (${filteredClientLicenses.length})`
              }
            >
              <motion.div
                key="clients"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={fadeIn}
              >
                <LicensesCompanyMatrix
                  licenses={filteredClientLicenses}
                  officeClientId={officeClientId}
                  onViewDetails={handleViewDetails}
                  onRenew={handleRenew}
                  onDelete={handleDelete}
                  canManage={isAdminOrFunc}
                  isLoading={isLoading}
                  emptyMessage="Nenhuma licença encontrada para os filtros selecionados."
                />
              </motion.div>
            </Tab>
            {isAdminOrFunc && (
              <Tab key="office" title={`Licenças do Escritório (${filteredOfficeLicenses.length})`}>
                <motion.div
                  key="office"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={fadeIn}
                >
                  <LicensesCompanyMatrix
                    licenses={filteredOfficeLicenses}
                    officeClientId={officeClientId}
                    onViewDetails={handleViewDetails}
                    onRenew={handleRenew}
                    onDelete={handleDelete}
                    canManage={isAdminOrFunc}
                    isLoading={isLoading}
                    emptyMessage={
                      officeClientId
                        ? "Nenhuma licença do escritório encontrada."
                        : "Informe NEXT_PUBLIC_OFFICE_CLIENT_ID para listar as licenças do escritório."
                    }
                  />
                </motion.div>
              </Tab>
            )}
            <Tab key="history" title="Histórico">
              <motion.div
                key="history"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={fadeIn}
              >
                <LicencasHistorico officeClientId={officeClientId} />
              </motion.div>
            </Tab>
            <Tab key="trash" title={`Lixeira (${trashLicenses.length})`}>
              <motion.div
                key="trash"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={fadeIn}
              >
                <LicencasLixeira
                  clientLicenses={trashClientLicenses}
                  officeLicenses={trashOfficeLicenses}
                  canSeeOffice={isAdminOrFunc && Boolean(officeClientId)}
                  isLoading={isTrashLoading}
                  restoringId={restoringId}
                  onRefresh={loadTrashLicenses}
                  onRestore={handleRestoreFromTrash}
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
              {selectedLicense && isAdminOrFunc && (
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

function LicensesCompanyMatrix({
  licenses,
  officeClientId,
  onViewDetails,
  onRenew,
  onDelete,
  canManage = true,
  isLoading,
  emptyMessage,
}: {
  licenses: License[];
  officeClientId?: string | null;
  onViewDetails: (license: License) => void;
  onRenew: (license: License) => void;
  onDelete: (license: License) => void;
  canManage?: boolean;
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

  const groupedRows = groupLicensesByCompany(licenses, officeClientId);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse">
        <thead>
          <tr className="border-b border-default-200 text-left text-xs uppercase tracking-wide text-default-500">
            <th className="px-3 py-3">Empresa</th>
            {MATRIX_LICENSE_TYPES.map((type) => (
              <th key={type} className="px-3 py-3 text-center">
                {LICENSE_TYPE_LABELS[type]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupedRows.map((row) => (
            <tr key={row.client_id} className="border-b border-default-100 align-top">
              <td className="px-3 py-3">
                <p className="font-semibold text-default-800">{row.client_name}</p>
                <p className="text-xs text-default-500">
                  {row.total} {row.total === 1 ? "licença" : "licenças"}
                </p>
              </td>
              {MATRIX_LICENSE_TYPES.map((type) => (
                <td key={`${row.client_id}-${type}`} className="px-3 py-3">
                  <LicenseTypeColumnCell
                    licenses={row.licensesByType[type] ?? []}
                    onViewDetails={onViewDetails}
                    onRenew={onRenew}
                    onDelete={onDelete}
                    canManage={canManage}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LicenseTypeColumnCell({
  licenses,
  onViewDetails,
  onRenew,
  onDelete,
  canManage = true,
}: {
  licenses: License[];
  onViewDetails?: (license: License) => void;
  onRenew?: (license: License) => void;
  onDelete?: (license: License) => void;
  canManage?: boolean;
}) {
  if (!licenses.length) {
    return <span className="text-sm text-default-300">—</span>;
  }

  return (
    <div className="space-y-2">
      {licenses.map((license) => {
        const status = normalizeLicenseStatus(license.status);
        const statusLabel = LICENSE_STATUS_LABELS[status];
        const statusColor = getLicenseStatusColor(status) as any;
        const isCancelled = status === LicenseStatus.CANCELLED;

        return (
          <div
            key={license.id}
            className="rounded-medium border border-default-200 bg-default-50/40 p-2"
          >
            <button
              type="button"
              onClick={() => onViewDetails?.(license)}
              className="text-left text-xs font-semibold text-primary hover:underline"
            >
              {license.registration_number}
            </button>
            <p className="text-[11px] text-default-500">{formatDatePtBR(license.expiration_date)}</p>
            <div className="pt-1">
              <Chip size="sm" color={statusColor} variant="flat">
                {statusLabel}
              </Chip>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => onViewDetails?.(license)}
                aria-label="Ver detalhes"
              >
                <Eye className="h-4 w-4" />
              </Button>
              {canManage && (
                <>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="primary"
                    isDisabled={isCancelled}
                    onPress={() => onRenew?.(license)}
                    aria-label="Renovar licença"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => onDelete?.(license)}
                    aria-label="Excluir licença"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function groupLicensesByCompany(
  licenses: License[],
  officeClientId?: string | null,
): Array<{
  client_id: string;
  client_name: string;
  total: number;
  licensesByType: Record<LicenseType, License[]>;
}> {
  const createTypesMap = (): Record<LicenseType, License[]> =>
    MATRIX_LICENSE_TYPES.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<LicenseType, License[]>);

  const rowsMap = new Map<
    string,
    {
      client_id: string;
      client_name: string;
      total: number;
      licensesByType: Record<LicenseType, License[]>;
    }
  >();

  for (const license of licenses) {
    const clientId = license.client_id;
    if (!rowsMap.has(clientId)) {
      rowsMap.set(clientId, {
        client_id: clientId,
        client_name: formatClientLabel(license, officeClientId),
        total: 0,
        licensesByType: createTypesMap(),
      });
    }

    const row = rowsMap.get(clientId)!;
    row.total += 1;
    const normalizedType = normalizeLicenseType(license.license_type);
    const mappedType = MATRIX_LICENSE_TYPES.includes(normalizedType)
      ? normalizedType
      : LicenseType.OUTRA;
    row.licensesByType[mappedType].push(license);
  }

  const rows = Array.from(rowsMap.values());

  for (const row of rows) {
    for (const type of MATRIX_LICENSE_TYPES) {
      row.licensesByType[type].sort((a, b) => {
        const aDate = a.expiration_date ? new Date(a.expiration_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.expiration_date ? new Date(b.expiration_date).getTime() : Number.MAX_SAFE_INTEGER;
        if (aDate !== bDate) return aDate - bDate;
        return a.registration_number.localeCompare(b.registration_number);
      });
    }
  }

  rows.sort((a, b) => a.client_name.localeCompare(b.client_name, "pt-BR"));
  return rows;
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
