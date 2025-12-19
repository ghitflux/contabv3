"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Switch,
} from "@/heroui";
import {
  LicenseStatus,
  LicenseType,
  LICENSE_STATUS_LABELS,
  LICENSE_TYPE_LABELS,
  SUMMARY_LICENSE_TYPES,
} from "@/types/license";
import { toast } from "@/lib/toast";

type LicenseCreatePayload = {
  client_id: string;
  license_type: LicenseType | string;
  status: LicenseStatus | string;
  issuing_authority: string;
  registration_number: string;
  issue_date: string | null;
  expiration_date: string | null;
  fee: number | null;
  fee_paid: boolean;
};

type LicenseCreateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: LicenseCreatePayload) => Promise<void>;
  defaultClientId?: string | null;
  selectedClientId?: string | null;
};

const OFFICE_CLIENT_ID = process.env.NEXT_PUBLIC_OFFICE_CLIENT_ID ?? null;

export function LicenseCreateModal({
  isOpen,
  onClose,
  onSubmit,
  defaultClientId,
  selectedClientId,
}: LicenseCreateModalProps) {
  const resolvedOfficeId = defaultClientId ?? OFFICE_CLIENT_ID;
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: resolvedOfficeId ?? "",
    isOffice: Boolean(resolvedOfficeId),
    license_type: LicenseType.ALVARA_FUNC,
    status: LicenseStatus.PENDING,
    issuing_authority: "",
    registration_number: "",
    issue_date: "",
    expiration_date: "",
    fee: "",
    fee_paid: false,
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        client_id: resolvedOfficeId ?? selectedClientId ?? "",
        isOffice: Boolean(resolvedOfficeId),
        license_type: LicenseType.ALVARA_FUNC,
        status: LicenseStatus.PENDING,
        issuing_authority: "",
        registration_number: "",
        issue_date: "",
        expiration_date: "",
        fee: "",
        fee_paid: false,
      });
    }
  }, [isOpen, resolvedOfficeId, selectedClientId]);

  const licenseTypeOptions = useMemo(
    () => Array.from(new Set([...SUMMARY_LICENSE_TYPES, LicenseType.INSCRICAO_MUNICIPAL, LicenseType.CERTIFICADO_DIGITAL])),
    []
  );

  const statusOptions = useMemo(
    () => [LicenseStatus.PENDING, LicenseStatus.ACTIVE, LicenseStatus.RENEWING, LicenseStatus.EXPIRED, LicenseStatus.CANCELLED],
    []
  );

  const setField = (key: string, value: any) =>
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  const handleSave = async () => {
    const hasOfficeClient = Boolean(resolvedOfficeId);
    if (form.isOffice && !hasOfficeClient) {
      toast.error("Configure o ID do escritório (NEXT_PUBLIC_OFFICE_CLIENT_ID) para salvar licenças do escritório.");
      return;
    }

    const isOffice = form.isOffice && hasOfficeClient;
    const clientId = isOffice ? resolvedOfficeId ?? "" : form.client_id.trim();

    if (!clientId) {
      toast.error("Informe o cliente da licença.");
      return;
    }
    if (!form.registration_number.trim()) {
      toast.error("Informe o número de registro.");
      return;
    }
    if (!form.issuing_authority.trim()) {
      toast.error("Informe o órgão emissor.");
      return;
    }

    try {
      setIsSaving(true);

      const payload: LicenseCreatePayload = {
        client_id: clientId,
        license_type: form.license_type,
        status: form.status,
        issuing_authority: form.issuing_authority.trim(),
        registration_number: form.registration_number.trim(),
        issue_date: form.issue_date || null,
        expiration_date: form.expiration_date || null,
        fee: form.fee ? Number(form.fee) : null,
        fee_paid: Boolean(form.fee_paid),
      };

      await onSubmit(payload);
      toast.success("Licença criada com sucesso.");
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível criar a licença.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      placement="center"
      size="2xl"
      backdrop="blur"
    >
      <ModalContent>
        <ModalHeader>Nova licença / alvará</ModalHeader>
        <ModalBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 flex items-center justify-between">
            <Switch
              isSelected={form.isOffice}
              onValueChange={(value) => {
                setField("isOffice", value);
                if (value) {
                  setField("client_id", resolvedOfficeId ?? "");
                } else if (selectedClientId) {
                  setField("client_id", selectedClientId);
                } else {
                  setField("client_id", "");
                }
              }}
            >
              É do escritório
            </Switch>
            {resolvedOfficeId && form.isOffice && (
              <span className="text-xs text-default-400 font-mono">{resolvedOfficeId}</span>
            )}
          </div>

          {!form.isOffice && (
            <Input
              label="Cliente (ID)"
              placeholder="UUID do cliente"
              value={form.client_id}
              onChange={(event) => setField("client_id", event.target.value)}
              isRequired
            />
          )}

          <Select
            label="Tipo de licença"
            selectedKeys={[form.license_type]}
            onSelectionChange={(keys) => {
              const key = Array.from(keys)[0] as LicenseType;
              if (key) {
                setField("license_type", key);
              }
            }}
          >
            {licenseTypeOptions.map((type) => (
              <SelectItem key={type} value={type}>
                {LICENSE_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </Select>

          <Select
            label="Status"
            selectedKeys={[form.status]}
            onSelectionChange={(keys) => {
              const key = Array.from(keys)[0] as LicenseStatus;
              if (key) {
                setField("status", key);
              }
            }}
          >
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {LICENSE_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </Select>

          <Input
            label="Órgão emissor"
            placeholder="Ex.: VISA Municipal"
            value={form.issuing_authority}
            onChange={(event) => setField("issuing_authority", event.target.value)}
            isRequired
          />

          <Input
            label="Número / protocolo"
            placeholder="Ex.: 12345-2025"
            value={form.registration_number}
            onChange={(event) => setField("registration_number", event.target.value)}
            isRequired
          />

          <Input
            type="date"
            label="Data de emissão"
            value={form.issue_date}
            onChange={(event) => setField("issue_date", event.target.value)}
            isRequired
          />

          <Input
            type="date"
            label="Data de vencimento (opcional)"
            value={form.expiration_date}
            onChange={(event) => setField("expiration_date", event.target.value)}
          />

          <Input
            type="number"
            label="Taxa (R$)"
            placeholder="0,00"
            value={form.fee}
            min={0}
            step="0.01"
            onChange={(event) => setField("fee", event.target.value)}
          />

          <div className="flex items-center gap-2">
            <Switch isSelected={form.fee_paid} onValueChange={(value) => setField("fee_paid", value)}>
              Taxa paga
            </Switch>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose} isDisabled={isSaving}>
            Cancelar
          </Button>
          <Button color="primary" onPress={handleSave} isLoading={isSaving}>
            Salvar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
