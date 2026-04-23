'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Input,
  Select,
  SelectItem,
  Textarea,
} from '@/heroui';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { financeApi } from '@/lib/api/endpoints/finance';
import { normalizeAmountForRequest } from '@/lib/finance/amount';
import { toast } from '@/lib/toast';
import { getFinancePresetDescriptions, mergeFinancePresetDescriptions } from '@/constants/financePresets';
import type { BankAccount } from '@/types/bank-account';
import {
  PaymentMethod,
  PaymentStatus,
  TransactionType,
  type Transaction,
  type TransactionCreate,
} from '@/types/finance';
import { formatISO } from 'date-fns';

type DisplayMovement = 'Entrada' | 'Saída' | 'Aplicação' | 'Resgate';

type QuickLaunchForm = {
  date: string;
  movement: DisplayMovement;
  bank: string;
  entryType: string;
  observation: string;
  value: string;
  isSettled: boolean;
  isRecurring: boolean;
  recurringDay: number;
};

interface ClienteLancamentoRapidoCardProps {
  clientId: string;
  bankAccounts: BankAccount[];
  transactions: Transaction[];
  createTransaction: (data: TransactionCreate) => Promise<Transaction>;
  onCreated?: () => Promise<unknown> | void;
}

const TYPE_PRESETS = {
  Entrada: mergeFinancePresetDescriptions(
    ['Recebimento de cliente', 'Serviço extra', 'Reembolso', 'Transferência recebida'],
    getFinancePresetDescriptions('income')
  ),
  Saída: mergeFinancePresetDescriptions(
    ['Honorários do mês', 'Imposto', 'Pró-labore', 'Pagamento de fornecedor'],
    getFinancePresetDescriptions('expense')
  ),
  Aplicação: mergeFinancePresetDescriptions(
    ['Aplicação financeira'],
    getFinancePresetDescriptions('financial_application')
  ),
  Resgate: mergeFinancePresetDescriptions(
    ['Resgate de aplicação financeira'],
    getFinancePresetDescriptions('financial_redemption')
  ),
} satisfies Record<DisplayMovement, string[]>;

const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';

const buildDefaultForm = (): QuickLaunchForm => ({
  date: formatISO(new Date(), { representation: 'date' }),
  movement: 'Entrada',
  bank: '',
  entryType: '',
  observation: '',
  value: '',
  isSettled: true,
  isRecurring: false,
  recurringDay: 1,
});

const getTransactionTypeFromMovement = (movement: DisplayMovement): TransactionType => {
  if (movement === 'Saída') return TransactionType.DESPESA;
  if (movement === 'Aplicação') return TransactionType.APLICACAO;
  if (movement === 'Resgate') return TransactionType.RESGATE;
  return TransactionType.RECEITA;
};

const isIncomingMovement = (movement: DisplayMovement) =>
  movement === 'Entrada' || movement === 'Resgate';

const getSettlementLabel = (movement: DisplayMovement) => {
  if (movement === 'Entrada') return 'Já recebido';
  if (movement === 'Resgate') return 'Já resgatado';
  if (movement === 'Aplicação') return 'Já aplicado';
  return 'Já pago';
};

export function ClienteLancamentoRapidoCard({
  clientId,
  bankAccounts,
  transactions,
  createTransaction,
  onCreated,
}: ClienteLancamentoRapidoCardProps) {
  const [form, setForm] = useState<QuickLaunchForm>(() => buildDefaultForm());
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const typeSuggestions = useMemo(() => {
    const transactionType = getTransactionTypeFromMovement(form.movement);

    const seen = new Set<string>();
    const suggestions: string[] = [];

    const appendValue = (value: string) => {
      const normalized = value.trim();
      if (!normalized || seen.has(normalized.toLowerCase())) {
        return;
      }
      seen.add(normalized.toLowerCase());
      suggestions.push(normalized);
    };

    TYPE_PRESETS[form.movement].forEach(appendValue);
    transactions
      .filter((transaction) => transaction.transaction_type === transactionType)
      .forEach((transaction) => appendValue(transaction.description));

    return suggestions;
  }, [form.movement, transactions]);

  const handleSubmit = async () => {
    if (!form.entryType.trim() || !form.value.trim()) {
      toast.error('Preencha o tipo e o valor para lançar.');
      return;
    }

    const amount = normalizeAmountForRequest(form.value);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    const selectedBank = bankAccounts.find((bank) => bank.id === form.bank);
    const bankName = selectedBank?.name;
    const notesParts = [];
    if (bankName) notesParts.push(`Banco: ${bankName}`);
    if (form.observation.trim()) notesParts.push(`Obs: ${form.observation.trim()}`);
    const notes = notesParts.length ? notesParts.join(' | ') : undefined;
    const referenceMonth = `${form.date.slice(0, 7)}-01`;
    const isSettled = !form.isRecurring && form.isSettled;
    const paidDate = isSettled ? new Date(`${form.date}T12:00:00`).toISOString() : null;

    try {
      setIsSubmitting(true);
      const transaction = await createTransaction({
        client_id: clientId,
        bank_account_id: selectedBank?.id ?? null,
        transaction_type:
          getTransactionTypeFromMovement(form.movement),
        amount,
        payment_method: !isSettled
          ? undefined
          : form.isRecurring
          ? undefined
          : bankName
            ? bankName.toLowerCase().includes('pix')
              ? PaymentMethod.PIX
              : PaymentMethod.TRANSFERENCIA
            : undefined,
        payment_status: isSettled ? PaymentStatus.PAGO : PaymentStatus.PENDENTE,
        due_date: form.date,
        paid_date: paidDate,
        reference_month: referenceMonth,
        description: form.entryType.trim(),
        notes,
        is_recurring: form.isRecurring,
        recurring_day: form.isRecurring ? form.recurringDay : null,
      });

      if (attachment) {
        try {
          await financeApi.uploadTransactionAttachment(transaction.id, attachment);
        } catch (error) {
          console.error('Erro ao enviar anexo do lançamento:', error);
          toast.error('Lançamento salvo, mas não foi possível enviar o anexo.');
          await onCreated?.();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
          }
          setForm(buildDefaultForm());
          setAttachment(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }
      }

      await onCreated?.();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
      setForm(buildDefaultForm());
      setAttachment(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  return (
    <Card className="border border-default-200/50 dark:border-default-100/20">
      <CardHeader>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Novo lançamento
          </h3>
          <p className="text-sm text-default-500">
            Registre rapidamente entradas, saídas, aplicações ou resgates. Se marcar recorrente, a
            competência atual nasce pendente para baixa manual.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {form.isRecurring && (
          <p className="text-xs text-default-500">
            Lançamentos recorrentes nascem pendentes e entram em contas a receber/pagar até a
            baixa manual.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_180px_140px_140px]">
          <DatePickerField
            label="Data"
            value={form.date}
            onChange={(value) => setForm((prev) => ({ ...prev, date: value }))}
          />
          <Select
            label="Movimento"
            selectedKeys={[form.movement]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as DisplayMovement | undefined;
              if (!value) return;
              setForm((prev) => ({
                ...prev,
                movement: value,
                entryType: '',
                isSettled: prev.isRecurring ? false : isIncomingMovement(value),
              }));
            }}
          >
            <SelectItem key="Entrada">Entrada</SelectItem>
            <SelectItem key="Saída">Saída</SelectItem>
            <SelectItem key="Aplicação">Aplicação</SelectItem>
            <SelectItem key="Resgate">Resgate</SelectItem>
          </Select>
          <Select
            label="Banco"
            selectedKeys={form.bank ? [form.bank] : []}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string | undefined;
              setForm((prev) => ({ ...prev, bank: value ?? '' }));
            }}
            placeholder="Selecione..."
          >
            {bankAccounts.map((bank) => (
              <SelectItem key={bank.id}>{bank.name}</SelectItem>
            ))}
          </Select>
          <Autocomplete
            label="Tipo"
            placeholder="Digite ou selecione..."
            inputValue={form.entryType}
            onInputChange={(value) => setForm((prev) => ({ ...prev, entryType: value }))}
            onSelectionChange={(key) => {
              if (!key) return;
              setForm((prev) => ({ ...prev, entryType: String(key) }));
            }}
            allowsCustomValue
          >
            {typeSuggestions.map((value) => (
              <AutocompleteItem key={value}>{value}</AutocompleteItem>
            ))}
          </Autocomplete>
          <Input
            type="text"
            label="Valor"
            placeholder="0,00"
            inputMode="decimal"
            value={form.value}
            onValueChange={(value) => setForm((prev) => ({ ...prev, value }))}
          />
          <div className="flex flex-col justify-center">
            <Checkbox
              isSelected={form.isSettled}
              onValueChange={(checked) => setForm((prev) => ({ ...prev, isSettled: checked }))}
              isDisabled={form.isRecurring}
            >
              {getSettlementLabel(form.movement)}
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
            className="w-full md:w-40"
          />
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
          <Textarea
            label="Observação (opcional)"
            placeholder="Adicione observações sobre este lançamento..."
            value={form.observation}
            onValueChange={(value) => setForm((prev) => ({ ...prev, observation: value }))}
            minRows={3}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Anexo (opcional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
              className="block w-full rounded-medium border border-default-200 bg-transparent px-3 py-3 text-sm text-default-700 file:mr-3 file:rounded-medium file:border-0 file:bg-default-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-default-700"
            />
            <p className="text-xs text-default-500">
              {attachment ? attachment.name : 'PDF, Office ou imagem.'}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
            + Lançar
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
