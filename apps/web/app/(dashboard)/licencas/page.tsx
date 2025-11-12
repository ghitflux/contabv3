"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  useDisclosure,
  Chip,
} from "@/heroui";
import { LicensesTable } from "@/components/features/licencas/LicensesTable";
import { LicenseFilters } from "@/components/features/licencas/LicenseFilters";
import { LicenseTimeline } from "@/components/features/licencas/LicenseTimeline";
import { useLicenses } from "@/hooks/useLicenses";
import { useClients } from "@/hooks/useClients";
import type { License, LicenseCreate, LicenseRenewal, LicenseUpdate } from "@/types/license";
import {
  LicenseType,
  LicenseStatus,
  LICENSE_TYPE_LABELS,
  LICENSE_STATUS_LABELS,
} from "@/types/license";
import { DatePickerField } from "@/components/ui/DatePickerField";

export default function LicencasPage() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [filters, setFilters] = useState<{
    query?: string;
    license_type?: LicenseType;
    status?: LicenseStatus;
    expiring_soon?: boolean;
    expired?: boolean;
    page?: number;
    size?: number;
  }>({});

  // Modals
  const {
    isOpen: isDetailsOpen,
    onOpen: onDetailsOpen,
    onClose: onDetailsClose,
  } = useDisclosure();
  const {
    isOpen: isCreateOpen,
    onOpen: onCreateOpen,
    onClose: onCreateClose,
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

  // Form states
  const [formData, setFormData] = useState<LicenseCreate>({
    client_id: "",
    license_type: LicenseType.ALVARA_FUNCIONAMENTO,
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

  const {
    licenses,
    isLoading: licensesLoading,
    createLicense,
    updateLicense,
    renewLicense,
    deleteLicense,
    fetchLicenses,
    fetchLicenseById,
  } = useLicenses();

  // Fetch clients on mount
  useEffect(() => {
    fetchClientsData({ size: 100 });
  }, [fetchClientsData]);

  // Fetch licenses when client or filters change
  useEffect(() => {
    if (selectedClientId) {
      fetchLicenses({
        ...filters,
        client_id: selectedClientId,
        page: filters.page || 1,
        size: filters.size || 10,
      });
    }
  }, [selectedClientId, filters, fetchLicenses]);

  const handleViewDetails = async (license: License) => {
    try {
      await fetchLicenseById(license.id);
      setSelectedLicense(license);
      onDetailsOpen();
    } catch (error) {
      console.error("Error fetching license details:", error);
    }
  };

  const handleCreate = () => {
    setFormData({
      client_id: selectedClientId || "",
      license_type: LicenseType.ALVARA_FUNCIONAMENTO,
      registration_number: "",
      issuing_authority: "",
      issue_date: new Date().toISOString().split("T")[0]!,
      expiration_date: null,
      notes: null,
    });
    onCreateOpen();
  };

  const handleEdit = (license: License) => {
    setSelectedLicense(license);
    setFormData({
      client_id: license.client_id,
      license_type: license.license_type,
      registration_number: license.registration_number,
      issuing_authority: license.issuing_authority,
      issue_date: license.issue_date,
      expiration_date: license.expiration_date,
      notes: license.notes,
    });
    onEditOpen();
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

  const handleDelete = (license: License) => {
    setSelectedLicense(license);
    onDeleteOpen();
  };

  const handleCreateSubmit = async () => {
    try {
      // Validate client_id
      if (!formData.client_id || formData.client_id === "") {
        console.error("Client ID is required");
        alert("Por favor, selecione um cliente antes de criar a licença.");
        return;
      }

      await createLicense(formData);
      onCreateClose();
      // Reset form
      setFormData({
        client_id: selectedClientId || "",
        license_type: LicenseType.ALVARA_FUNCIONAMENTO,
        registration_number: "",
        issuing_authority: "",
        issue_date: new Date().toISOString().split("T")[0]!,
        expiration_date: null,
        notes: null,
      });
      // Refresh list
      fetchLicenses({
        ...filters,
        client_id: selectedClientId,
      });
    } catch (error) {
      console.error("Error creating license:", error);
      alert(error instanceof Error ? error.message : "Erro ao criar licença. Verifique os dados e tente novamente.");
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedLicense) return;
    try {
      const updateData: LicenseUpdate = {
        license_type: formData.license_type,
        registration_number: formData.registration_number,
        issuing_authority: formData.issuing_authority,
        issue_date: formData.issue_date,
        expiration_date: formData.expiration_date,
        notes: formData.notes,
      };
      await updateLicense(selectedLicense.id, updateData);
      onEditClose();
      fetchLicenses({
        ...filters,
        client_id: selectedClientId,
      });
    } catch (error) {
      console.error("Error updating license:", error);
    }
  };

  const handleRenewSubmit = async () => {
    if (!selectedLicense) return;
    try {
      await renewLicense(selectedLicense.id, renewalData);
      onRenewClose();
      fetchLicenses({
        ...filters,
        client_id: selectedClientId,
      });
    } catch (error) {
      console.error("Error renewing license:", error);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedLicense) return;
    try {
      await deleteLicense(selectedLicense.id);
      onDeleteClose();
      fetchLicenses({
        ...filters,
        client_id: selectedClientId,
      });
    } catch (error) {
      console.error("Error deleting license:", error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Sem data";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR").format(date);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Licenças e Certificações</h1>
        <p className="text-default-500 mt-1">
          Gerencie licenças, alvarás e certificações dos clientes
        </p>
      </div>

      {/* Client Selector */}
      <Card>
        <CardBody>
          <Select
            label="Selecione um Cliente"
            placeholder="Escolha um cliente"
            selectedKeys={selectedClientId ? [selectedClientId] : []}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              setSelectedClientId(selected || "");
            }}
            isLoading={clientsLoading}
          >
            {(clients?.items || []).map((client) => (
              <SelectItem key={client.id}>
                {client.razao_social} - {client.cnpj}
              </SelectItem>
            ))}
          </Select>
        </CardBody>
      </Card>

      {selectedClientId && (
        <>
          {/* Filters */}
          <Card>
            <CardBody>
              <LicenseFilters
                onFilterChange={(newFilters) => setFilters({ ...filters, ...newFilters, page: 1 })}
                onCreateClick={handleCreate}
              />
            </CardBody>
          </Card>

          {/* Licenses Table */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Lista de Licenças</h2>
            </CardHeader>
            <Divider />
            <CardBody>
              <LicensesTable
                licenses={licenses?.items || []}
                loading={licensesLoading}
                onViewDetails={handleViewDetails}
                onRenew={handleRenew}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </CardBody>
          </Card>
        </>
      )}

      {/* Details Modal */}
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
                      {LICENSE_TYPE_LABELS[selectedLicense.license_type]}
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
                    <p className="font-semibold">{formatDate(selectedLicense.issue_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-default-500">Data de Vencimento</p>
                    <p className="font-semibold">{formatDate(selectedLicense.expiration_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-default-500">Status</p>
                    <Chip
                      color={selectedLicense.is_expired ? "danger" : selectedLicense.is_expiring_soon ? "warning" : "success"}
                      size="sm"
                      variant="flat"
                    >
                      {LICENSE_STATUS_LABELS[selectedLicense.status]}
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

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="2xl">
        <ModalContent>
          <ModalHeader>Nova Licença</ModalHeader>
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
                  <SelectItem key={type}>
                    {LICENSE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </Select>
              <Input
                label="Número de Registro"
                value={formData.registration_number}
                onChange={(e) =>
                  setFormData({ ...formData, registration_number: e.target.value })
                }
                isRequired
              />
              <Input
                label="Órgão Emissor"
                value={formData.issuing_authority}
                onChange={(e) =>
                  setFormData({ ...formData, issuing_authority: e.target.value })
                }
                isRequired
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
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value || null })
                }
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCreateClose}>
              Cancelar
            </Button>
            <Button
              color="primary"
              onPress={handleCreateSubmit}
              isDisabled={
                !formData.client_id ||
                !formData.registration_number ||
                !formData.issuing_authority
              }
            >
              Criar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Modal */}
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
                  <SelectItem key={type}>
                    {LICENSE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </Select>
              <Input
                label="Número de Registro"
                value={formData.registration_number}
                onChange={(e) =>
                  setFormData({ ...formData, registration_number: e.target.value })
                }
                isRequired
              />
              <Input
                label="Órgão Emissor"
                value={formData.issuing_authority}
                onChange={(e) =>
                  setFormData({ ...formData, issuing_authority: e.target.value })
                }
                isRequired
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
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value || null })
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
              isDisabled={
                !formData.registration_number || !formData.issuing_authority
              }
            >
              Salvar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Renew Modal */}
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
              <Input
                label="Novo Número de Registro (opcional)"
                value={renewalData.new_registration_number || ""}
                onChange={(e) =>
                  setRenewalData({
                    ...renewalData,
                    new_registration_number: e.target.value || null,
                  })
                }
              />
              <Textarea
                label="Notas de Renovação (opcional)"
                value={renewalData.notes || ""}
                onChange={(e) =>
                  setRenewalData({ ...renewalData, notes: e.target.value || null })
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

      {/* Delete Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalContent>
          <ModalHeader>Excluir Licença</ModalHeader>
          <ModalBody>
            <p>
              Tem certeza que deseja excluir esta licença? Esta ação não pode
              ser desfeita.
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
    </div>
  );
}

