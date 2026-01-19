"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Textarea,
} from "@/heroui";
import { useEffect, useState } from "react";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { PlanoDeContasAutocomplete } from "@/components/ui/PlanoDeContasAutocomplete";
import { TransactionType, PaymentStatus, PaymentMethod } from "@/types/finance";
import { formatISO } from "date-fns";
import { toast } from "@/lib/toast";

interface NovoLancamentoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: NovoLancamentoData) => void | Promise<void>;
  clients?: Array<{ id: string; name: string }>;
  isLoadingClients?: boolean;
  defaultClientId?: string | null;
  isClientLocked?: boolean;
}

export interface NovoLancamentoData {
  client_id: string;
  transaction_type: TransactionType;
  amount: number;
  payment_method?: PaymentMethod | null;
  payment_status: PaymentStatus;
  due_date: string;
  paid_date?: string | null;
  reference_month: string;
  description: string;
  category?: string | null;
  notes?: string | null;
  invoice_number?: string | null;
}

export function NovoLancamentoModal({
  isOpen,
  onOpenChange,
  onSave,
  clients = [],
  isLoadingClients = false,
  defaultClientId = null,
  isClientLocked = false,
}: NovoLancamentoModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<NovoLancamentoData>>({
    transaction_type: TransactionType.RECEITA,
    payment_status: PaymentStatus.PENDENTE,
    due_date: formatISO(new Date(), { representation: "date" }),
    reference_month: formatISO(new Date(), { representation: "date" }).slice(0, 7) + "-01",
  });

  useEffect(() => {
    if (!isOpen || !defaultClientId) return;
    setFormData((prev) => {
      if (prev.client_id === defaultClientId) return prev;
      return { ...prev, client_id: defaultClientId };
    });
  }, [defaultClientId, isOpen]);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Validate required fields
      if (
        !formData.client_id ||
        !formData.amount ||
        !formData.due_date ||
        !formData.reference_month ||
        !formData.description
      ) {
        toast.error("Preencha todos os campos obrigatórios.");
        return;
      }

      await onSave(formData as NovoLancamentoData);
      onOpenChange(false);

      // Reset form
      setFormData({
        transaction_type: TransactionType.RECEITA,
        payment_status: PaymentStatus.PENDENTE,
        due_date: formatISO(new Date(), { representation: "date" }),
        reference_month: formatISO(new Date(), { representation: "date" }).slice(0, 7) + "-01",
      });
    } catch (error) {
      console.error("Erro ao salvar lançamento:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold">Novo Lançamento Financeiro</h3>
              <p className="text-sm font-normal text-default-500">
                Preencha os dados do lançamento
              </p>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                {/* Tipo de Transação */}
                <Select
                  label="Tipo de Transação"
                  placeholder="Selecione o tipo"
                  selectedKeys={formData.transaction_type ? [formData.transaction_type] : []}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as TransactionType | undefined;
                    setFormData((prev) => ({ ...prev, transaction_type: value }));
                  }}
                  isRequired
                  variant="bordered"
                >
                  <SelectItem key={TransactionType.RECEITA}>💰 Receita</SelectItem>
                  <SelectItem key={TransactionType.DESPESA}>📊 Despesa</SelectItem>
                </Select>

                {/* Cliente */}
                <Select
                  label="Cliente"
                  placeholder={isLoadingClients ? "Carregando clientes..." : "Selecione o cliente"}
                  selectedKeys={formData.client_id ? [formData.client_id] : []}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string | undefined;
                    setFormData((prev) => ({ ...prev, client_id: value }));
                  }}
                  isRequired
                  variant="bordered"
                  isLoading={isLoadingClients}
                  isDisabled={isLoadingClients || isClientLocked}
                  items={clients}
                >
                  {(client) => <SelectItem key={client.id}>{client.name}</SelectItem>}
                </Select>

                {/* Categoria (Plano de Contas) */}
                <PlanoDeContasAutocomplete
                  value={formData.category ?? null}
                  onChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                  variant="bordered"
                />

                {/* Descrição */}
                <Input
                  label="Descrição"
                  placeholder="Ex: Honorários de janeiro/2024"
                  value={formData.description || ""}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, description: value }))}
                  isRequired
                  variant="bordered"
                />

                {/* Valor */}
                <Input
                  label="Valor (R$)"
                  placeholder="0,00"
                  type="number"
                  step="0.01"
                  value={formData.amount?.toString() || ""}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, amount: Number.parseFloat(value) || 0 }))
                  }
                  isRequired
                  variant="bordered"
                  startContent={
                    <div className="pointer-events-none flex items-center">
                      <span className="text-default-400 text-small">R$</span>
                    </div>
                  }
                />

                <div className="grid grid-cols-2 gap-4">
                  {/* Data de Vencimento */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data de Vencimento *</label>
                    <DatePickerField
                      value={formData.due_date || ""}
                      onChange={(value) => setFormData((prev) => ({ ...prev, due_date: value }))}
                    />
                  </div>

                  {/* Mês de Competência */}
                  <Input
                    label="Competência (YYYY-MM)"
                    placeholder="2024-01"
                    type="month"
                    value={formData.reference_month?.slice(0, 7) || ""}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, reference_month: value ? `${value}-01` : "" }))
                    }
                    isRequired
                    variant="bordered"
                  />
                </div>

                {/* Status do Pagamento */}
                <Select
                  label="Status do Pagamento"
                  placeholder="Selecione o status"
                  selectedKeys={formData.payment_status ? [formData.payment_status] : []}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as PaymentStatus | undefined;
                    setFormData((prev) => ({ ...prev, payment_status: value }));
                  }}
                  isRequired
                  variant="bordered"
                >
                  <SelectItem key={PaymentStatus.PENDENTE}>Pendente</SelectItem>
                  <SelectItem key={PaymentStatus.PAGO}>Pago</SelectItem>
                  <SelectItem key={PaymentStatus.PARCIAL}>Parcial</SelectItem>
                  <SelectItem key={PaymentStatus.ATRASADO}>Atrasado</SelectItem>
                  <SelectItem key={PaymentStatus.CANCELADO}>Cancelado</SelectItem>
                </Select>

                {/* Método de Pagamento (opcional) */}
                <Select
                  label="Método de Pagamento"
                  placeholder="Selecione (opcional)"
                  selectedKeys={formData.payment_method ? [formData.payment_method] : []}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as PaymentMethod | undefined;
                    setFormData((prev) => ({ ...prev, payment_method: value || null }));
                  }}
                  variant="bordered"
                >
                  <SelectItem key={PaymentMethod.PIX}>PIX</SelectItem>
                  <SelectItem key={PaymentMethod.BOLETO}>Boleto</SelectItem>
                  <SelectItem key={PaymentMethod.TRANSFERENCIA}>Transferência</SelectItem>
                  <SelectItem key={PaymentMethod.DINHEIRO}>Dinheiro</SelectItem>
                  <SelectItem key={PaymentMethod.CARTAO_CREDITO}>Cartão de Crédito</SelectItem>
                  <SelectItem key={PaymentMethod.CARTAO_DEBITO}>Cartão de Débito</SelectItem>
                  <SelectItem key={PaymentMethod.CHEQUE}>Cheque</SelectItem>
                </Select>

                {/* Data de Pagamento (se status = PAGO) */}
                {formData.payment_status === PaymentStatus.PAGO && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data de Pagamento</label>
                    <DatePickerField
                      value={formData.paid_date || ""}
                      onChange={(value) => setFormData((prev) => ({ ...prev, paid_date: value }))}
                    />
                  </div>
                )}

                {/* Número da Nota/Fatura (opcional) */}
                <Input
                  label="Número da Nota/Fatura"
                  placeholder="Ex: NF-001/2024"
                  value={formData.invoice_number || ""}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, invoice_number: value || null }))}
                  variant="bordered"
                />

                {/* Observações (opcional) */}
                <Textarea
                  label="Observações"
                  placeholder="Informações adicionais..."
                  value={formData.notes || ""}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, notes: value || null }))}
                  variant="bordered"
                  minRows={3}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose} isDisabled={isSubmitting}>
                Cancelar
              </Button>
              <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
                Salvar Lançamento
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
