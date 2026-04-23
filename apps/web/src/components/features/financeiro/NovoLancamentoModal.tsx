"use client";

import {
  Autocomplete,
  AutocompleteItem,
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
import { useEffect, useMemo, useState } from "react";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { PlanoDeContasAutocomplete } from "@/components/ui/PlanoDeContasAutocomplete";
import { TransactionType, PaymentStatus, PaymentMethod } from "@/types/finance";
import { isPlanoContaCodigo } from "@/constants/planoDeContas";
import { getFinancePresetDescriptions, type FinanceHistoryType } from "@/constants/financePresets";
import { formatISO } from "date-fns";
import { toast } from "@/lib/toast";
import { normalizeAmountForRequest } from "@/lib/finance/amount";

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

type NovoLancamentoFormData = Omit<NovoLancamentoData, "amount" | "reference_month"> & {
  amount: string;
  launch_date: string;
};

const toReferenceMonth = (dateValue: string) =>
  dateValue ? `${dateValue.slice(0, 7)}-01` : "";

const buildDefaultDates = (baseDate: Date) => {
  const launchDate = formatISO(baseDate, { representation: "date" });
  return {
    launch_date: launchDate,
    due_date: launchDate,
  };
};

type CategoryMode = "plano" | "custom";

const MAX_CUSTOM_CATEGORY_LENGTH = 20;

const getPresetTypeForTransactionType = (
  transactionType?: TransactionType
): FinanceHistoryType => {
  if (transactionType === TransactionType.DESPESA) return "expense";
  if (transactionType === TransactionType.APLICACAO) return "financial_application";
  if (transactionType === TransactionType.RESGATE) return "financial_redemption";
  return "income";
};

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
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("plano");
  const [customCategory, setCustomCategory] = useState("");
  const [formData, setFormData] = useState<Partial<NovoLancamentoFormData>>({
    transaction_type: TransactionType.RECEITA,
    payment_status: PaymentStatus.PENDENTE,
    launch_date: "",
    due_date: "",
    amount: "",
  });

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    const defaults = buildDefaultDates(now);
    setCategoryMode("plano");
    setCustomCategory("");
    setFormData((prev) => ({
      ...prev,
      ...defaults,
      transaction_type: prev.transaction_type ?? TransactionType.RECEITA,
      payment_status: prev.payment_status ?? PaymentStatus.PENDENTE,
    }));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !defaultClientId) return;
    setFormData((prev) => {
      if (prev.client_id === defaultClientId) return prev;
      return { ...prev, client_id: defaultClientId };
    });
  }, [defaultClientId, isOpen]);

  const descriptionSuggestions = useMemo(
    () => getFinancePresetDescriptions(getPresetTypeForTransactionType(formData.transaction_type)),
    [formData.transaction_type]
  );

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Validate required fields
      if (
        !formData.client_id ||
        !formData.amount?.trim() ||
        !formData.launch_date ||
        !formData.due_date ||
        !formData.description
      ) {
        toast.error("Preencha todos os campos obrigatórios.");
        return;
      }

      const amountValue = normalizeAmountForRequest(formData.amount);
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        toast.error("Informe um valor válido.");
        return;
      }

      const clientId = formData.client_id;
      const launchDate = formData.launch_date;
      const dueDate = formData.due_date;
      const description = formData.description?.trim();
      if (!clientId || !launchDate || !dueDate || !description) {
        toast.error("Preencha todos os campos obrigatórios.");
        return;
      }

      let normalizedCategory: string | null = null;
      if (categoryMode === "custom") {
        const customValue = customCategory.trim();
        if (!customValue) {
          toast.error("Informe o nome da categoria personalizada.");
          return;
        }
        if (customValue.length > MAX_CUSTOM_CATEGORY_LENGTH) {
          toast.error(
            `A categoria personalizada deve ter até ${MAX_CUSTOM_CATEGORY_LENGTH} caracteres.`
          );
          return;
        }
        normalizedCategory = customValue;
      } else {
        const selectedCategory = formData.category?.trim();
        normalizedCategory = selectedCategory || null;
      }

      await onSave({
        client_id: clientId,
        transaction_type: formData.transaction_type ?? TransactionType.RECEITA,
        amount: amountValue,
        payment_method: formData.payment_method ?? null,
        payment_status: formData.payment_status ?? PaymentStatus.PENDENTE,
        due_date: dueDate,
        paid_date:
          formData.payment_status === PaymentStatus.PAGO ? formData.paid_date ?? null : null,
        reference_month: toReferenceMonth(launchDate),
        description,
        category: normalizedCategory,
        notes: formData.notes?.trim() || null,
        invoice_number: formData.invoice_number?.trim() || null,
      });
      onOpenChange(false);

      // Reset form
      setCategoryMode("plano");
      setCustomCategory("");
      setFormData({
        transaction_type: TransactionType.RECEITA,
        payment_status: PaymentStatus.PENDENTE,
        launch_date: "",
        due_date: "",
        amount: "",
        category: null,
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
                  <SelectItem key={TransactionType.APLICACAO}>Aplicação financeira</SelectItem>
                  <SelectItem key={TransactionType.RESGATE}>Resgate de aplicação</SelectItem>
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

                <Select
                  label="Tipo de Categoria"
                  selectedKeys={[categoryMode]}
                  onSelectionChange={(keys) => {
                    const nextMode = (Array.from(keys)[0] as CategoryMode | undefined) ?? "plano";
                    if (nextMode === "custom") {
                      const currentCategory = formData.category?.trim();
                      if (
                        currentCategory &&
                        !isPlanoContaCodigo(currentCategory) &&
                        customCategory.length === 0
                      ) {
                        setCustomCategory(currentCategory);
                      }
                    } else {
                      setCustomCategory("");
                    }
                    setCategoryMode(nextMode);
                  }}
                  variant="bordered"
                >
                  <SelectItem key="plano">Plano de contas (inclui impostos)</SelectItem>
                  <SelectItem key="custom">Categoria personalizada</SelectItem>
                </Select>

                {categoryMode === "plano" ? (
                  <PlanoDeContasAutocomplete
                    value={formData.category ?? null}
                    onChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                    label="Categoria (Plano de Contas)"
                    placeholder="Inclui impostos federais, estaduais e municipais"
                    variant="bordered"
                  />
                ) : (
                  <Input
                    label="Categoria personalizada"
                    placeholder="Ex: Imposto complementar"
                    value={customCategory}
                    onValueChange={setCustomCategory}
                    maxLength={MAX_CUSTOM_CATEGORY_LENGTH}
                    variant="bordered"
                    description={`Até ${MAX_CUSTOM_CATEGORY_LENGTH} caracteres.`}
                    isRequired
                  />
                )}

                {/* Descrição */}
                <Autocomplete
                  label="Descrição"
                  placeholder="Ex: Honorários de janeiro/2024"
                  inputValue={formData.description || ""}
                  onInputChange={(value) =>
                    setFormData((prev) => ({ ...prev, description: value }))
                  }
                  onSelectionChange={(key) => {
                    if (!key) return;
                    setFormData((prev) => ({ ...prev, description: String(key) }));
                  }}
                  allowsCustomValue
                  listboxProps={{
                    emptyContent: "Nenhuma sugestão encontrada",
                  }}
                  isRequired
                  variant="bordered"
                >
                  {descriptionSuggestions.map((value) => (
                    <AutocompleteItem key={value}>{value}</AutocompleteItem>
                  ))}
                </Autocomplete>

                {/* Valor */}
                <Input
                  label="Valor (R$)"
                  placeholder="0,00"
                  type="text"
                  inputMode="decimal"
                  value={formData.amount || ""}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, amount: value }))}
                  isRequired
                  variant="bordered"
                  startContent={
                    <div className="pointer-events-none flex items-center">
                      <span className="text-default-400 text-small">R$</span>
                    </div>
                  }
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Data de Lançamento */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data de Lançamento *</label>
                    <DatePickerField
                      value={formData.launch_date || ""}
                      onChange={(value) =>
                        setFormData((prev) => {
                          const shouldSyncDueDate =
                            !prev.due_date || prev.due_date === prev.launch_date;
                          return {
                            ...prev,
                            launch_date: value,
                            due_date: shouldSyncDueDate ? value : prev.due_date,
                          };
                        })
                      }
                    />
                  </div>

                  {/* Data de Vencimento */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data de Vencimento *</label>
                    <DatePickerField
                      value={formData.due_date || ""}
                      onChange={(value) => setFormData((prev) => ({ ...prev, due_date: value }))}
                    />
                  </div>
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
