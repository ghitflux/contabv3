'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from '@/heroui';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { normalizeAmountForRequest } from '@/lib/finance/amount';
import { toast } from '@/lib/toast';
import {
  FINANCE_HISTORY_PRESETS,
  type FinanceHistoryType,
} from '@/constants/financePresets';
import {
  DISTRIBUTION_PROFITS_CATEGORY,
  PaymentMethod,
  PaymentStatus,
  TransactionType,
  type Transaction,
  type TransactionCreate,
} from '@/types/finance';
import { formatISO } from 'date-fns';

type DisplayMovement =
  | 'Entrada'
  | 'Saída'
  | 'Distribuição de Lucros'
  | 'Aplicação'
  | 'Resgate';

type StandardHistory = {
  id: string;
  description: string;
  type: FinanceHistoryType;
};

type QuickLaunchForm = {
  date: string;
  movement: DisplayMovement;
  history: string;
  observation: string;
  value: string;
  isSettled: boolean;
  isRecurring: boolean;
  recurringDay: number;
};

interface ClienteLancamentoRapidoCardProps {
  clientId: string;
  createTransaction: (data: TransactionCreate) => Promise<Transaction>;
  onCreated?: () => Promise<unknown> | void;
}

const CLIENT_HISTORY_STORAGE_KEY = 'financeiro:clientes:historicos';

const initialHistories: StandardHistory[] = FINANCE_HISTORY_PRESETS.map((preset) => ({
  id: preset.id,
  description: preset.description,
  type: preset.type,
}));

const HISTORY_TYPE_LABELS: Record<FinanceHistoryType, string> = {
  income: 'Receita',
  expense: 'Despesa',
  profit_distribution: 'Distribuição de lucros',
  financial_application: 'Aplicação',
  financial_redemption: 'Resgate',
};

const buildDefaultForm = (): QuickLaunchForm => ({
  date: formatISO(new Date(), { representation: 'date' }),
  movement: 'Entrada',
  history: '',
  observation: '',
  value: '',
  isSettled: true,
  isRecurring: false,
  recurringDay: 1,
});

const getTransactionTypeFromMovement = (movement: DisplayMovement): TransactionType => {
  if (movement === 'Saída') return TransactionType.DESPESA;
  if (movement === 'Distribuição de Lucros') return TransactionType.DESPESA;
  if (movement === 'Aplicação') return TransactionType.APLICACAO;
  if (movement === 'Resgate') return TransactionType.RESGATE;
  return TransactionType.RECEITA;
};

const getHistoryTypeForMovement = (movement: DisplayMovement): FinanceHistoryType => {
  if (movement === 'Entrada') return 'income';
  if (movement === 'Distribuição de Lucros') return 'profit_distribution';
  if (movement === 'Aplicação') return 'financial_application';
  if (movement === 'Resgate') return 'financial_redemption';
  return 'expense';
};

const isIncomingMovement = (movement: DisplayMovement) =>
  movement === 'Entrada' || movement === 'Resgate';

const getSettlementLabel = (movement: DisplayMovement) => {
  if (movement === 'Entrada') return 'Já recebido';
  if (movement === 'Resgate') return 'Já resgatado';
  if (movement === 'Aplicação') return 'Já aplicado';
  return 'Já pago';
};

const mergeStandardHistories = (
  baseHistories: StandardHistory[],
  incomingHistories: StandardHistory[]
): StandardHistory[] => {
  const merged = [...baseHistories];
  const seen = new Set(
    baseHistories.map(
      (history) => `${history.type}:${history.description.trim().toLocaleLowerCase('pt-BR')}`
    )
  );

  incomingHistories.forEach((history) => {
    const normalizedDescription = history.description.trim();
    if (!normalizedDescription) return;
    const key = `${history.type}:${normalizedDescription.toLocaleLowerCase('pt-BR')}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      ...history,
      description: normalizedDescription,
    });
  });

  return merged;
};

export function ClienteLancamentoRapidoCard({
  clientId,
  createTransaction,
  onCreated,
}: ClienteLancamentoRapidoCardProps) {
  const [form, setForm] = useState<QuickLaunchForm>(() => buildDefaultForm());
  const [standardHistories, setStandardHistories] = useState<StandardHistory[]>(initialHistories);
  const [hasLoadedStoredHistories, setHasLoadedStoredHistories] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [newHistory, setNewHistory] = useState({
    description: '',
    type: 'income' as FinanceHistoryType,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || hasLoadedStoredHistories) return;
    const storedValue = window.localStorage.getItem(CLIENT_HISTORY_STORAGE_KEY);
    if (!storedValue) {
      setHasLoadedStoredHistories(true);
      return;
    }
    try {
      const parsed = JSON.parse(storedValue);
      if (!Array.isArray(parsed)) {
        setHasLoadedStoredHistories(true);
        return;
      }
      const normalized = parsed
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const id =
            typeof item.id === 'string'
              ? item.id
              : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : String(Date.now());
          const description = typeof item.description === 'string' ? item.description.trim() : '';
          const type =
            typeof item.type === 'string' && item.type in HISTORY_TYPE_LABELS
              ? (item.type as FinanceHistoryType)
              : null;
          if (!description || !type) return null;
          return { id, description, type } satisfies StandardHistory;
        })
        .filter((item): item is StandardHistory => item !== null);

      setStandardHistories((prev) => mergeStandardHistories(prev, normalized));
    } catch {
      // Ignore invalid storage and keep defaults.
    } finally {
      setHasLoadedStoredHistories(true);
    }
  }, [hasLoadedStoredHistories]);

  useEffect(() => {
    if (typeof window === 'undefined' || !hasLoadedStoredHistories) return;
    window.localStorage.setItem(CLIENT_HISTORY_STORAGE_KEY, JSON.stringify(standardHistories));
  }, [hasLoadedStoredHistories, standardHistories]);

  const historiesForMovement = useMemo(
    () =>
      standardHistories.filter(
        (history) => history.type === getHistoryTypeForMovement(form.movement)
      ),
    [form.movement, standardHistories]
  );

  const settlementLabel = getSettlementLabel(form.movement);

  const handleSubmit = async () => {
    if (!form.history || !form.value.trim()) {
      toast.error('Preencha o histórico e o valor para lançar.');
      return;
    }

    const amount = normalizeAmountForRequest(form.value);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    const notesParts = [];
    if (form.observation.trim()) notesParts.push(`Obs: ${form.observation.trim()}`);
    const notes = notesParts.length ? notesParts.join(' | ') : undefined;
    const referenceMonth = `${form.date.slice(0, 7)}-01`;
    const isSettled = !form.isRecurring && form.isSettled;
    const paidDate = isSettled ? new Date(`${form.date}T12:00:00`).toISOString() : null;
    const isProfitDistribution = form.movement === 'Distribuição de Lucros';

    try {
      setIsSubmitting(true);
      await createTransaction({
        client_id: clientId,
        transaction_type: getTransactionTypeFromMovement(form.movement),
        amount,
        payment_method: !isSettled
          ? undefined
          : form.isRecurring
          ? undefined
          : PaymentMethod.TRANSFERENCIA,
        payment_status: isSettled ? PaymentStatus.PAGO : PaymentStatus.PENDENTE,
        due_date: form.date,
        paid_date: paidDate,
        reference_month: referenceMonth,
        description: form.history,
        category: isProfitDistribution ? DISTRIBUTION_PROFITS_CATEGORY : null,
        notes,
        is_recurring: form.isRecurring,
        recurring_day: form.isRecurring ? form.recurringDay : null,
      });

      await onCreated?.();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
      setForm(buildDefaultForm());
      toast.success(
        form.isRecurring
          ? 'Série recorrente criada; competência atual lançada como pendente.'
          : 'Lançamento registrado com sucesso.'
      );
    } catch (error) {
      console.error('Erro ao salvar lançamento rápido do cliente:', error);
      const errorDetail = (error as { data?: { detail?: string } })?.data?.detail;
      toast.error(
        typeof errorDetail === 'string'
          ? errorDetail
          : 'Não foi possível registrar o lançamento.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddHistory = () => {
    const normalizedDescription = newHistory.description.trim();
    if (!normalizedDescription) return;
    if (
      standardHistories.some(
        (history) =>
          history.description.toLowerCase() === normalizedDescription.toLowerCase() &&
          history.type === newHistory.type
      )
    ) {
      toast.error('Já existe um histórico com esta descrição.');
      return;
    }

    const history: StandardHistory = {
      id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : String(Date.now()),
      description: normalizedDescription,
      type: newHistory.type,
    };

    setStandardHistories((prev) => [...prev, history]);
    setIsHistoryModalOpen(false);
    setNewHistory({ description: '', type: 'income' });
  };

  return (
    <>
      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Novo lançamento
          </h3>
          <Button
            variant="bordered"
            size="sm"
            onPress={() => setIsHistoryModalOpen(true)}
            className="w-full sm:w-auto"
          >
            + Novo Histórico
          </Button>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <DatePickerField
              label="Data"
              value={form.date}
              onChange={(value) => setForm((prev) => ({ ...prev, date: value }))}
            />
            <Select
              label="Tipo"
              selectedKeys={[form.movement]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as DisplayMovement | undefined;
                if (!value) return;
                setForm((prev) => ({
                  ...prev,
                  movement: value,
                  history: '',
                  isSettled: prev.isRecurring ? false : isIncomingMovement(value),
                }));
              }}
            >
              <SelectItem key="Entrada">Entrada</SelectItem>
              <SelectItem key="Saída">Saída</SelectItem>
              <SelectItem key="Distribuição de Lucros">Distribuição de lucros</SelectItem>
              <SelectItem key="Aplicação">Aplicação</SelectItem>
              <SelectItem key="Resgate">Resgate</SelectItem>
            </Select>
            <Select
              label="Histórico"
              selectedKeys={form.history ? [form.history] : []}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string | undefined;
                setForm((prev) => ({ ...prev, history: value ?? '' }));
              }}
              placeholder="Selecione..."
            >
              {historiesForMovement.map((history) => (
                <SelectItem key={history.description}>{history.description}</SelectItem>
              ))}
            </Select>
            <Input
              type="number"
              label="Valor"
              placeholder="0,00"
              step="0.01"
              min="0"
              value={form.value}
              onValueChange={(value) => setForm((prev) => ({ ...prev, value }))}
            />
            <div className="flex flex-col justify-center">
              <Checkbox
                isSelected={form.isSettled}
                onValueChange={(checked) =>
                  setForm((prev) => ({ ...prev, isSettled: checked }))
                }
                isDisabled={form.isRecurring}
              >
                {settlementLabel}
              </Checkbox>
            </div>
            <div className="flex flex-col justify-center">
              <Checkbox
                isSelected={form.isRecurring}
                onValueChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    isRecurring: checked,
                    isSettled: checked ? false : isIncomingMovement(prev.movement),
                    recurringDay: checked ? prev.recurringDay : 1,
                  }))
                }
              >
                Recorrente
              </Checkbox>
            </div>
          </div>

          <Textarea
            label="Observação (opcional)"
            placeholder="Adicione observações sobre este lançamento..."
            value={form.observation}
            onValueChange={(value) => setForm((prev) => ({ ...prev, observation: value }))}
            minRows={2}
          />

          {form.isRecurring && (
            <Input
              type="number"
              label="Dia de Recorrência"
              min={1}
              max={31}
              value={String(form.recurringDay)}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  recurringDay: Number.parseInt(value || '1', 10),
                }))
              }
              className="w-32"
            />
          )}

          <div className="flex justify-end">
            <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
              + Lançar
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Novo Histórico</ModalHeader>
              <ModalBody className="space-y-3">
                <Input
                  label="Descrição"
                  placeholder="Ex: Recebimento de honorários"
                  value={newHistory.description}
                  onValueChange={(value) =>
                    setNewHistory((prev) => ({ ...prev, description: value }))
                  }
                />
                <Select
                  label="Tipo"
                  selectedKeys={[newHistory.type]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as FinanceHistoryType | undefined;
                    if (!value) return;
                    setNewHistory((prev) => ({ ...prev, type: value }));
                  }}
                >
                  {Object.entries(HISTORY_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value}>{label}</SelectItem>
                  ))}
                </Select>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="primary" onPress={handleAddHistory}>
                  Salvar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
