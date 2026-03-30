'use client';

import { DatePickerField } from '@/components/ui/DatePickerField';
import {
  Accordion,
  AccordionItem,
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
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Textarea,
} from '@/heroui';
import {
  CheckCircle,
  DollarSign,
  Download,
  Pencil,
  Plus,
  Repeat,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FinanceiroKPIs, type FinanceiroKpi } from './FinanceiroKPIs';
import { useTransactions } from '@/hooks/useTransactions';
import {
  type MonthlyFeePreviewResponse,
  PaymentMethod,
  PaymentStatus,
  TransactionType,
  type Transaction,
  type TransactionUpdate,
  isDuePaymentStatus,
  getPaymentStatusLabel,
  getPaymentMethodLabel,
} from '@/types/finance';
import { toast } from '@/lib/toast';
import { formatISO } from 'date-fns';
import { MonthYearPicker } from '@/components/ui/MonthYearPicker';
import { bankAccountsApi } from '@/lib/api/endpoints/bank-accounts';
import { financeApi } from '@/lib/api/endpoints/finance';
import type { BankAccount } from '@/types/bank-account';
import { TransactionTrashModal } from './TransactionTrashModal';
import { ConfirmBaixaLancamentoDialog } from './ConfirmBaixaLancamentoDialog';
import { ConfirmDeleteLancamentoDialog } from './ConfirmDeleteLancamentoDialog';
import { normalizeAmountForRequest } from '@/lib/finance/amount';
import { formatLocalDate } from '@/lib/finance/date';
import {
  buildDateRangeForMonth,
  getCurrentMonthFilterState,
  getCurrentMonthValue,
  getPreviousMonthFilterState,
  normalizeMonthFilterFromRange,
} from '@/lib/finance/month-filter';

type DisplayTransactionType = 'Entrada' | 'Saída';

type DisplayTransaction = {
  id: string;
  date: string;
  type: DisplayTransactionType;
  bank: string;
  history: string;
  observation?: string;
  value: number;
  status: PaymentStatus;
  raw: Transaction;
  isRecurring?: boolean;
  recurringDay?: number;
};

type StandardHistory = {
  id: string;
  description: string;
  accountingAccount?: string;
  type: 'income' | 'expense';
};

type NewTransactionState = {
  date: string;
  type: DisplayTransactionType;
  bank: string;
  history: string;
  observation: string;
  value: string;
  isRecurring: boolean;
  recurringDay: number;
};

const initialHistories: StandardHistory[] = [
  { id: '1', description: 'Honorários do mês', accountingAccount: '3.1.1.01', type: 'income' },
  { id: '2', description: 'Serviço extra', accountingAccount: '3.1.1.02', type: 'income' },
  { id: '3', description: 'Aluguel', accountingAccount: '2.1.1.01', type: 'expense' },
  { id: '4', description: 'Internet', accountingAccount: '2.1.1.02', type: 'expense' },
];

const buildDefaultTransaction = (baseDate: Date = new Date()): NewTransactionState => ({
  date: formatISO(baseDate, { representation: 'date' }),
  type: 'Entrada',
  bank: '1',
  history: '',
  observation: '',
  value: '',
  isRecurring: false,
  recurringDay: 1,
});

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const TRANSACTIONS_PER_PAGE = 20;

const normalizeDateInput = (value?: string | null): string => {
  if (!value) return '';
  const [datePart] = value.split('T');
  return datePart ?? '';
};

const HONORARIOS_DESCRIPTION_PATTERN = /^Honorários - (.+?) \(([^)]+)\) - (\d{2}\/\d{4})$/;

const formatMonthYear = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return `${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`;
};

type ActiveTransactionPanel = 'all' | 'receber' | 'pagar' | 'receita' | 'despesa';

export function FinanceiroEscritorio({ onExportLivro }: { onExportLivro?: () => void }) {
  const initialMonthFilterState = getCurrentMonthFilterState();
  const [monthFilter, setMonthFilter] = useState(initialMonthFilterState.monthFilter);
  const [startDate, setStartDate] = useState(initialMonthFilterState.startDate);
  const [endDate, setEndDate] = useState(initialMonthFilterState.endDate);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [standardHistories, setStandardHistories] = useState<StandardHistory[]>(initialHistories);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    message: string;
    bankName: string;
  }>({
    isOpen: false,
    message: '',
    bankName: '',
  });
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [bankForm, setBankForm] = useState({
    name: '',
    account_number: '',
    balance: '',
    accounting_account: '',
  });
  const [newHistory, setNewHistory] = useState({
    description: '',
    accountingAccount: '',
    type: 'income' as 'income' | 'expense',
  });
  const [newTransaction, setNewTransaction] = useState<NewTransactionState>(() =>
    buildDefaultTransaction()
  );
  const [activePendingPanel, setActivePendingPanel] = useState<ActiveTransactionPanel>('all');
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [pendingBaixaTransaction, setPendingBaixaTransaction] = useState<Transaction | null>(null);
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState<Transaction | null>(
    null
  );
  const [isConfirmingBaixa, setIsConfirmingBaixa] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [isBulkUpdatingTransactions, setIsBulkUpdatingTransactions] = useState(false);
  const [selectedHonorariosIds, setSelectedHonorariosIds] = useState<string[]>([]);
  const [isDeletingHonorarios, setIsDeletingHonorarios] = useState(false);
  const [feePreview, setFeePreview] = useState<MonthlyFeePreviewResponse | null>(null);
  const [isLoadingFeePreview, setIsLoadingFeePreview] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editForm, setEditForm] = useState({
    description: '',
    amount: '',
    due_date: '',
    payment_status: PaymentStatus.PENDENTE,
    payment_method: '' as PaymentMethod | '',
    paid_date: '',
    category: '',
    notes: '',
    invoice_number: '',
  });

  // OFFICE_CLIENT_ID is used for transactions (still required)
  // Bank accounts use office_only flag instead
  const OFFICE_CLIENT_ID = process.env.NEXT_PUBLIC_OFFICE_CLIENT_ID ?? '';

  // Funções para gerenciar bancos do escritório
  const resetBankForm = useCallback(() => {
    setBankForm({
      name: '',
      account_number: '',
      balance: '',
      accounting_account: '',
    });
    setEditingBank(null);
  }, []);

  const openBankModal = useCallback(
    (bank?: BankAccount | null) => {
      if (bank) {
        setEditingBank(bank);
        setBankForm({
          name: bank.name,
          account_number: bank.account_number,
          balance: bank.balance?.toString() ?? '',
          accounting_account: bank.accounting_account ?? '',
        });
      } else {
        resetBankForm();
      }
      setIsBankModalOpen(true);
    },
    [resetBankForm]
  );

  const loadBankAccounts = useCallback(async () => {
    setIsLoadingBanks(true);
    try {
      const response = await bankAccountsApi.list({
        office_only: true,
        limit: 200,
      });
      const normalized = response.items.map((bank) => ({
        ...bank,
        balance: Number(bank.balance) || 0,
      }));
      setBankAccounts(normalized);
    } catch (error) {
      console.error('Erro ao carregar bancos do escritório', error);
      toast.error('Não foi possível carregar os bancos.');
    } finally {
      setIsLoadingBanks(false);
    }
  }, []);

  useEffect(() => {
    void loadBankAccounts();
  }, [loadBankAccounts]);

  const handleSaveBank = async () => {
    if (!bankForm.name.trim() || !bankForm.account_number.trim()) {
      toast.error('Informe o nome e o número da conta.');
      return;
    }

    const balanceValue = bankForm.balance ? normalizeAmountForRequest(bankForm.balance) : 0;
    if (Number.isNaN(balanceValue) || balanceValue < 0) {
      toast.error('Informe um saldo inicial válido (mínimo R$ 0,00).');
      return;
    }

    setIsSavingBank(true);
    try {
      const savedBankName = bankForm.name.trim();
      if (editingBank) {
        await bankAccountsApi.update(editingBank.id, {
          name: savedBankName,
          account_number: bankForm.account_number.trim(),
          balance: balanceValue,
          accounting_account: bankForm.accounting_account.trim() || null,
        });
        setSuccessModal({
          isOpen: true,
          message: 'Banco atualizado com sucesso!',
          bankName: savedBankName,
        });
      } else {
        // Create office bank account (no client_id)
        await bankAccountsApi.create({
          name: savedBankName,
          account_number: bankForm.account_number.trim(),
          balance: balanceValue,
          accounting_account: bankForm.accounting_account.trim() || null,
        });
        setSuccessModal({
          isOpen: true,
          message: 'Banco cadastrado com sucesso!',
          bankName: savedBankName,
        });
      }
      setIsBankModalOpen(false);
      resetBankForm();
      await loadBankAccounts();
    } catch (error) {
      console.error('Erro ao salvar banco', error);
      const errorDetail = (error as { data?: { detail?: string } })?.data?.detail;
      const message =
        typeof errorDetail === 'string' ? errorDetail : 'Não foi possível salvar o banco.';
      toast.error(message);
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleDeleteBank = async (bankId: string) => {
    const confirmed = window.confirm('Tem certeza que deseja excluir este banco?');
    if (!confirmed) return;
    try {
      await bankAccountsApi.delete(bankId);
      toast.success('Banco removido com sucesso.');
      await loadBankAccounts();
    } catch (error) {
      console.error('Erro ao excluir banco', error);
      toast.error('Não foi possível excluir o banco.');
    }
  };

  const { transactions, createTransaction, updateTransaction, deleteTransaction, refresh } =
    useTransactions({
      filters: {
        client_id: OFFICE_CLIENT_ID || undefined,
        ...(monthFilter
          ? { reference_month: monthFilter }
          : { due_date_from: startDate, due_date_to: endDate }),
        page: 1,
        size: 100,
      },
      autoFetch: true,
      fetchAllPages: true,
    });

  const displayTransactions = useMemo<DisplayTransaction[]>(() => {
    return transactions.map((transaction) => ({
      id: transaction.id,
      date: transaction.paid_date || transaction.due_date,
      type: transaction.transaction_type === TransactionType.RECEITA ? 'Entrada' : 'Saída',
      bank: transaction.payment_method
        ? getPaymentMethodLabel(transaction.payment_method) || transaction.payment_method
        : '-',
      history: transaction.description,
      observation: transaction.notes || undefined,
      value: transaction.amount,
      status: transaction.payment_status,
      raw: transaction,
      isRecurring: Boolean(transaction.recurring_template_id),
    }));
  }, [transactions]);

  useEffect(() => {
    setTransactionsPage(1);
  }, [startDate, endDate, OFFICE_CLIENT_ID]);

  useEffect(() => {
    setTransactionsPage(1);
  }, [searchQuery]);

  const filteredDisplayTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return displayTransactions;
    return displayTransactions.filter((t) => {
      return (
        t.history.toLowerCase().includes(query) ||
        (t.observation ?? '').toLowerCase().includes(query) ||
        (t.raw.category ?? '').toLowerCase().includes(query)
      );
    });
  }, [displayTransactions, searchQuery]);

  const totalTransactionPages = useMemo(() => {
    if (filteredDisplayTransactions.length === 0) return 1;
    return Math.ceil(filteredDisplayTransactions.length / TRANSACTIONS_PER_PAGE);
  }, [filteredDisplayTransactions.length]);

  useEffect(() => {
    if (transactionsPage > totalTransactionPages) {
      setTransactionsPage(totalTransactionPages);
    }
  }, [transactionsPage, totalTransactionPages]);

  useEffect(() => {
    const validIds = new Set(filteredDisplayTransactions.map((transaction) => transaction.id));
    setSelectedTransactionIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [filteredDisplayTransactions]);

  const paginatedDisplayTransactions = useMemo(() => {
    const startIndex = (transactionsPage - 1) * TRANSACTIONS_PER_PAGE;
    const endIndex = startIndex + TRANSACTIONS_PER_PAGE;
    return filteredDisplayTransactions.slice(startIndex, endIndex);
  }, [filteredDisplayTransactions, transactionsPage]);

  const transactionRangeLabel = useMemo(() => {
    if (filteredDisplayTransactions.length === 0) {
      return 'Mostrando 0 de 0';
    }
    const startIndex = (transactionsPage - 1) * TRANSACTIONS_PER_PAGE + 1;
    const endIndex = Math.min(transactionsPage * TRANSACTIONS_PER_PAGE, filteredDisplayTransactions.length);
    return `Mostrando ${startIndex}-${endIndex} de ${filteredDisplayTransactions.length}`;
  }, [filteredDisplayTransactions.length, transactionsPage]);

  const paidTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.payment_status === PaymentStatus.PAGO),
    [transactions]
  );

  const receita = useMemo(
    () =>
      paidTransactions
        .filter((transaction) => transaction.transaction_type === TransactionType.RECEITA)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [paidTransactions]
  );
  const despesa = useMemo(
    () =>
      paidTransactions
        .filter((transaction) => transaction.transaction_type === TransactionType.DESPESA)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [paidTransactions]
  );
  const lucro = receita - despesa;
  const receivableTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.transaction_type === TransactionType.RECEITA &&
          isDuePaymentStatus(transaction.payment_status)
      ),
    [transactions]
  );
  const payableTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.transaction_type === TransactionType.DESPESA &&
          isDuePaymentStatus(transaction.payment_status)
      ),
    [transactions]
  );
  const aReceber = useMemo(
    () => receivableTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    [receivableTransactions]
  );
  const aPagar = useMemo(
    () => payableTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    [payableTransactions]
  );

  const panelTransactions = useMemo<DisplayTransaction[]>(() => {
    if (activePendingPanel === 'receber') {
      return filteredDisplayTransactions.filter(
        (transaction) =>
          transaction.raw.transaction_type === TransactionType.RECEITA &&
          isDuePaymentStatus(transaction.status)
      );
    }
    if (activePendingPanel === 'pagar') {
      return filteredDisplayTransactions.filter(
        (transaction) =>
          transaction.raw.transaction_type === TransactionType.DESPESA &&
          isDuePaymentStatus(transaction.status)
      );
    }
    if (activePendingPanel === 'receita') {
      return filteredDisplayTransactions.filter(
        (transaction) =>
          transaction.raw.transaction_type === TransactionType.RECEITA &&
          transaction.status === PaymentStatus.PAGO
      );
    }
    if (activePendingPanel === 'despesa') {
      return filteredDisplayTransactions.filter(
        (transaction) =>
          transaction.raw.transaction_type === TransactionType.DESPESA &&
          transaction.status === PaymentStatus.PAGO
      );
    }
    return [];
  }, [activePendingPanel, filteredDisplayTransactions]);

  const honorariosTransactions = useMemo(() => {
    return transactions
      .filter(
        (transaction) =>
          transaction.client_id === OFFICE_CLIENT_ID &&
          transaction.transaction_type === TransactionType.RECEITA &&
          transaction.description.startsWith('Honorários -')
      )
      .map((transaction) => {
        const descriptionMatch = transaction.description.match(HONORARIOS_DESCRIPTION_PATTERN);
        const cliente = descriptionMatch?.[1] ?? '-';
        const cnpj = descriptionMatch?.[2] ?? '-';
        const competenciaLabel =
          descriptionMatch?.[3] ?? formatMonthYear(transaction.reference_month);

        return {
          id: transaction.id,
          cliente,
          cnpj,
          competenciaLabel,
          dueDate: transaction.due_date,
          paidDate: transaction.paid_date ?? null,
          amount: transaction.amount,
          paymentStatus: transaction.payment_status,
          paymentMethod: transaction.payment_method ?? null,
        };
      });
  }, [transactions, OFFICE_CLIENT_ID]);

  const totalHonorarios = useMemo(
    () => honorariosTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    [honorariosTransactions]
  );

  useEffect(() => {
    const validHonorariosIds = new Set(honorariosTransactions.map((transaction) => transaction.id));
    setSelectedHonorariosIds((prev) => prev.filter((id) => validHonorariosIds.has(id)));
  }, [honorariosTransactions]);

  const selectedTransactionSet = useMemo(
    () => new Set(selectedTransactionIds),
    [selectedTransactionIds]
  );
  const selectedHonorariosSet = useMemo(
    () => new Set(selectedHonorariosIds),
    [selectedHonorariosIds]
  );
  const isAllHonorariosSelected = useMemo(
    () =>
      honorariosTransactions.length > 0 &&
      honorariosTransactions.every((transaction) => selectedHonorariosSet.has(transaction.id)),
    [honorariosTransactions, selectedHonorariosSet]
  );
  const isAllTransactionsOnPageSelected = useMemo(
    () =>
      paginatedDisplayTransactions.length > 0 &&
      paginatedDisplayTransactions.every((transaction) => selectedTransactionSet.has(transaction.id)),
    [paginatedDisplayTransactions, selectedTransactionSet]
  );
  const isAllPanelTransactionsSelected = useMemo(
    () =>
      panelTransactions.length > 0 &&
      panelTransactions.every((transaction) => selectedTransactionSet.has(transaction.id)),
    [panelTransactions, selectedTransactionSet]
  );

  const setRangeForMonth = (monthValue: string) => {
    const { startDate: nextStartDate, endDate: nextEndDate } = buildDateRangeForMonth(monthValue);
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
  };

  const setCurrentMonthRange = () => {
    const currentMonthFilterState = getCurrentMonthFilterState();
    setMonthFilter(currentMonthFilterState.monthFilter);
    setStartDate(currentMonthFilterState.startDate);
    setEndDate(currentMonthFilterState.endDate);
  };

  const setPreviousMonthRange = () => {
    const previousMonthFilterState = getPreviousMonthFilterState();
    setMonthFilter(previousMonthFilterState.monthFilter);
    setStartDate(previousMonthFilterState.startDate);
    setEndDate(previousMonthFilterState.endDate);
  };

  const handleMonthChange = (value: string) => {
    setMonthFilter(value);
    if (!value) {
      setStartDate('');
      setEndDate('');
      return;
    }
    setRangeForMonth(value);
  };

  useEffect(() => {
    const normalized = normalizeMonthFilterFromRange(startDate, endDate);
    if (normalized && normalized !== monthFilter) {
      setMonthFilter(normalized);
    }
    if (!normalized && monthFilter) {
      setMonthFilter('');
    }
  }, [startDate, endDate, monthFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleRefresh = () => {
      refresh().catch((error) => {
        console.error('Erro ao atualizar lançamentos do escritório', error);
      });
    };
    window.addEventListener('finance:transactions-updated', handleRefresh);
    return () => {
      window.removeEventListener('finance:transactions-updated', handleRefresh);
    };
  }, [refresh]);

  useEffect(() => {
    const referenceMonth = `${monthFilter || getCurrentMonthValue()}-01`;
    let active = true;

    (async () => {
      try {
        setIsLoadingFeePreview(true);
        const preview = await financeApi.previewMonthlyFees({ reference_month: referenceMonth });
        if (active) {
          setFeePreview(preview);
        }
      } catch (error) {
        console.error('Erro ao carregar prévia de honorários', error);
        if (active) {
          setFeePreview(null);
        }
      } finally {
        if (active) {
          setIsLoadingFeePreview(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [monthFilter, transactions.length]);

  const toggleTransactionSelection = (transactionId: string, checked: boolean) => {
    setSelectedTransactionIds((prev) => {
      if (checked) {
        if (prev.includes(transactionId)) return prev;
        return [...prev, transactionId];
      }
      return prev.filter((id) => id !== transactionId);
    });
  };

  const toggleAllTransactionsOnPage = (checked: boolean) => {
    if (!checked) {
      const pageIds = new Set(paginatedDisplayTransactions.map((transaction) => transaction.id));
      setSelectedTransactionIds((prev) => prev.filter((id) => !pageIds.has(id)));
      return;
    }

    setSelectedTransactionIds((prev) => {
      const next = new Set(prev);
      paginatedDisplayTransactions.forEach((transaction) => next.add(transaction.id));
      return Array.from(next);
    });
  };

  const toggleAllPanelTransactions = (checked: boolean) => {
    if (!checked) {
      const panelIds = new Set(panelTransactions.map((transaction) => transaction.id));
      setSelectedTransactionIds((prev) => prev.filter((id) => !panelIds.has(id)));
      return;
    }

    setSelectedTransactionIds((prev) => {
      const next = new Set(prev);
      panelTransactions.forEach((transaction) => next.add(transaction.id));
      return Array.from(next);
    });
  };

  const handleBulkUpdateTransactions = async (targetStatus: PaymentStatus) => {
    if (!selectedTransactionIds.length) {
      toast.error('Selecione pelo menos um lançamento.');
      return;
    }

    setIsBulkUpdatingTransactions(true);

    try {
      const response =
        targetStatus === PaymentStatus.PAGO
          ? await financeApi.bulkPayTransactions({
              transaction_ids: selectedTransactionIds,
              paid_date: new Date().toISOString(),
              payment_method: PaymentMethod.TRANSFERENCIA,
            })
          : await financeApi.bulkReopenTransactions({
              transaction_ids: selectedTransactionIds,
            });

      await refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }

      setSelectedTransactionIds([]);

      if (response.failed > 0) {
        toast.error(
          `${response.succeeded} lançamento(s) atualizado(s) e ${response.failed} com falha na operação em lote.`
        );
      } else {
        toast.success(`${response.succeeded} lançamento(s) atualizado(s) em lote.`);
      }
    } catch (error) {
      console.error('Erro ao atualizar lançamentos em lote', error);
      toast.error('Não foi possível concluir a operação em lote.');
    } finally {
      setIsBulkUpdatingTransactions(false);
    }
  };

  const handleBulkDeleteTransactions = async () => {
    if (!selectedTransactionIds.length) {
      toast.error('Selecione pelo menos um lançamento.');
      return;
    }

    setIsBulkUpdatingTransactions(true);
    try {
      const response = await financeApi.bulkDeleteTransactions({
        transaction_ids: selectedTransactionIds,
      });
      await refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
      setSelectedTransactionIds([]);

      if (response.failed > 0) {
        toast.error(
          `${response.succeeded} lançamento(s) excluído(s) e ${response.failed} falharam.`
        );
      } else {
        toast.success(`${response.succeeded} lançamento(s) excluído(s) em lote.`);
      }
    } catch (error) {
      console.error('Erro ao excluir lançamentos em lote', error);
      toast.error('Não foi possível excluir os lançamentos selecionados.');
    } finally {
      setIsBulkUpdatingTransactions(false);
    }
  };

  const toggleHonorariosSelection = (transactionId: string, checked: boolean) => {
    setSelectedHonorariosIds((prev) => {
      if (checked) {
        if (prev.includes(transactionId)) return prev;
        return [...prev, transactionId];
      }
      return prev.filter((id) => id !== transactionId);
    });
  };

  const toggleAllHonorariosSelection = (checked: boolean) => {
    if (!checked) {
      setSelectedHonorariosIds([]);
      return;
    }
    setSelectedHonorariosIds(honorariosTransactions.map((transaction) => transaction.id));
  };

  const refreshFeePreview = async () => {
    const referenceMonth = `${monthFilter || getCurrentMonthValue()}-01`;
    try {
      setIsLoadingFeePreview(true);
      const preview = await financeApi.previewMonthlyFees({ reference_month: referenceMonth });
      setFeePreview(preview);
    } catch (error) {
      console.error('Erro ao atualizar prévia de honorários', error);
      setFeePreview(null);
      throw error;
    } finally {
      setIsLoadingFeePreview(false);
    }
  };

  const handleGenerateFees = async () => {
    try {
      const referenceMonth = `${monthFilter || getCurrentMonthValue()}-01`;
      const response = await financeApi.generateMonthlyFees({ reference_month: referenceMonth });
      await refresh();
      await refreshFeePreview();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
      toast.success(response.message || 'Honorários gerados com sucesso.');
    } catch (error) {
      console.error('Erro ao gerar honorários', error);
      toast.error('Não foi possível gerar os honorários.');
    }
  };

  const handleBulkDeleteHonorarios = async () => {
    if (!selectedHonorariosIds.length) {
      toast.error('Selecione pelo menos um honorário.');
      return;
    }

    setIsDeletingHonorarios(true);
    try {
      const response = await financeApi.bulkDeleteMonthlyFees({
        office_transaction_ids: selectedHonorariosIds,
      });
      await refresh();
      await refreshFeePreview();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
      setSelectedHonorariosIds([]);

      if (response.failed > 0) {
        toast.error(
          `${response.succeeded} honorário(s) excluído(s) e ${response.failed} falharam.`
        );
      } else {
        toast.success(
          `${response.succeeded} honorário(s) excluído(s) com bloqueio da competência.`
        );
      }
    } catch (error) {
      console.error('Erro ao excluir honorários em lote', error);
      toast.error('Não foi possível excluir os honorários selecionados.');
    } finally {
      setIsDeletingHonorarios(false);
    }
  };

  const kpis: FinanceiroKpi[] = [
    {
      id: 'receita',
      title: 'Receita do Período',
      value: formatCurrency(receita),
      change: '+4,2% vs mês anterior',
      trend: 'up',
      icon: DollarSign,
      colorClass: 'text-green-600',
      backgroundClass: 'bg-green-50 dark:bg-green-900/20',
      isPressable: true,
      onPress: () =>
        setActivePendingPanel((prev) => (prev === 'receita' ? 'all' : 'receita')),
    },
    {
      id: 'despesa',
      title: 'Despesas',
      value: formatCurrency(despesa),
      change: '+1,8% vs mês anterior',
      trend: 'up',
      icon: TrendingDown,
      colorClass: 'text-amber-600',
      backgroundClass: 'bg-amber-50 dark:bg-amber-900/20',
      isPressable: true,
      onPress: () =>
        setActivePendingPanel((prev) => (prev === 'despesa' ? 'all' : 'despesa')),
    },
    {
      id: 'lucro',
      title: 'Lucro',
      value: formatCurrency(lucro),
      change: '+6,5% vs mês anterior',
      trend: 'up',
      icon: TrendingUp,
      colorClass: 'text-teal-600',
      backgroundClass: 'bg-teal-50 dark:bg-teal-900/20',
    },
  ];

  const handleAddTransaction = async () => {
    if (!newTransaction.history || !newTransaction.value) {
      toast.error('Preencha o histórico e o valor para lançar.');
      return;
    }
    if (!OFFICE_CLIENT_ID) {
      toast.error(
        'Configure o ID do escritório (NEXT_PUBLIC_OFFICE_CLIENT_ID) para lançar receitas/despesas.'
      );
      return;
    }

    const amount = normalizeAmountForRequest(newTransaction.value);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    const bankName = bankAccounts.find((bank) => bank.id === newTransaction.bank)?.name;
    const notesParts = [];
    if (bankName) notesParts.push(`Banco: ${bankName}`);
    if (newTransaction.observation) notesParts.push(`Obs: ${newTransaction.observation}`);
    const notes = notesParts.length ? notesParts.join(' | ') : undefined;
    const paidDate = new Date(`${newTransaction.date}T12:00:00`).toISOString();
    const referenceMonth = `${newTransaction.date.slice(0, 7)}-01`;

    try {
      await createTransaction({
        client_id: OFFICE_CLIENT_ID,
        transaction_type:
          newTransaction.type === 'Entrada' ? TransactionType.RECEITA : TransactionType.DESPESA,
        amount,
        payment_method: newTransaction.isRecurring
          ? undefined
          : bankName
            ? bankName.toLowerCase().includes('pix')
              ? PaymentMethod.PIX
              : PaymentMethod.TRANSFERENCIA
            : undefined,
        payment_status: newTransaction.isRecurring ? PaymentStatus.PENDENTE : PaymentStatus.PAGO,
        due_date: newTransaction.date,
        paid_date: newTransaction.isRecurring ? null : paidDate,
        reference_month: referenceMonth,
        description: newTransaction.history,
        notes,
        is_recurring: newTransaction.isRecurring,
        recurring_day: newTransaction.isRecurring ? newTransaction.recurringDay : null,
      });
      await refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
      setNewTransaction(buildDefaultTransaction());
      toast.success(
        newTransaction.isRecurring
          ? 'Série recorrente criada; competência atual lançada como pendente.'
          : 'Lançamento registrado com sucesso.'
      );
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível registrar o lançamento.');
    }
  };

  const handleDeleteTransaction = async () => {
    if (!pendingDeleteTransaction) return;
    try {
      setIsConfirmingDelete(true);
      await deleteTransaction(pendingDeleteTransaction.id);
      toast.success('Lançamento removido.');
      await refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
      setPendingDeleteTransaction(null);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível remover o lançamento.');
    } finally {
      setIsConfirmingDelete(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!pendingBaixaTransaction) return;
    try {
      setIsConfirmingBaixa(true);
      const paymentMethod = pendingBaixaTransaction.payment_method ?? PaymentMethod.TRANSFERENCIA;
      await updateTransaction(pendingBaixaTransaction.id, {
        payment_status: PaymentStatus.PAGO,
        payment_method: paymentMethod,
        paid_date: new Date().toISOString(),
      });
      toast.success('Lançamento baixado com sucesso.');
      await refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
      setPendingBaixaTransaction(null);
    } catch (error) {
      console.error('Erro ao baixar lançamento', error);
      toast.error('Não foi possível realizar a baixa.');
    } finally {
      setIsConfirmingBaixa(false);
    }
  };

  const openEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setEditForm({
      description: transaction.description ?? '',
      amount: transaction.amount?.toString() ?? '',
      due_date: normalizeDateInput(transaction.due_date),
      payment_status: transaction.payment_status ?? PaymentStatus.PENDENTE,
      payment_method: transaction.payment_method ?? '',
      paid_date: normalizeDateInput(transaction.paid_date),
      category: transaction.category ?? '',
      notes: transaction.notes ?? '',
      invoice_number: transaction.invoice_number ?? '',
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;

    const amountValue = normalizeAmountForRequest(editForm.amount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    if (!editForm.description.trim()) {
      toast.error('Informe a descrição.');
      return;
    }
    if (!editForm.due_date) {
      toast.error('Informe a data de vencimento.');
      return;
    }

    const payload: TransactionUpdate = {
      amount: amountValue,
      description: editForm.description.trim(),
      due_date: editForm.due_date,
      payment_status: editForm.payment_status,
      payment_method: editForm.payment_method ? editForm.payment_method : null,
      paid_date:
        editForm.payment_status === PaymentStatus.PAGO
          ? editForm.paid_date || new Date().toISOString()
          : null,
      category: editForm.category.trim() || null,
      notes: editForm.notes.trim() || null,
      invoice_number: editForm.invoice_number.trim() || null,
    };

    try {
      await updateTransaction(editingTransaction.id, payload);
      toast.success('Lançamento atualizado com sucesso.');
      setIsEditModalOpen(false);
      setEditingTransaction(null);
      await refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
    } catch (error) {
      console.error('Erro ao atualizar lançamento', error);
      toast.error('Não foi possível atualizar o lançamento.');
    }
  };

  const handleAddHistory = () => {
    if (!newHistory.description) return;

    const history: StandardHistory = {
      id: String(standardHistories.length + 1),
      description: newHistory.description,
      accountingAccount: newHistory.accountingAccount || undefined,
      type: newHistory.type,
    };

    setStandardHistories((prev) => [...prev, history]);
    setIsHistoryModalOpen(false);
    setNewHistory({ description: '', accountingAccount: '', type: 'income' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <div className="space-y-2">
          <MonthYearPicker
            label="Mês de referência"
            value={monthFilter}
            onChange={handleMonthChange}
            size="sm"
            className="w-full sm:w-[180px]"
            aria-label="Mês de referência"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Início</label>
          <DatePickerField
            value={startDate}
            onChange={setStartDate}
            size="sm"
            className="w-full sm:w-[180px]"
            aria-label="Data inicial"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Fim</label>
          <DatePickerField
            value={endDate}
            onChange={setEndDate}
            size="sm"
            className="w-full sm:w-[180px]"
            aria-label="Data final"
          />
        </div>
        <div className="space-y-2 flex-1 min-w-[200px]">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Buscar</label>
          <Input
            size="sm"
            placeholder="Descrição, categoria ou histórico..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            startContent={<Search className="h-4 w-4 text-default-400" />}
            isClearable
            onClear={() => setSearchQuery('')}
            aria-label="Buscar lançamentos"
          />
        </div>
        <div className="md:ml-auto flex flex-wrap gap-2">
          <Button variant="bordered" onPress={setCurrentMonthRange}>
            Mês atual
          </Button>
          <Button variant="bordered" onPress={setPreviousMonthRange}>
            Mês anterior
          </Button>
          <Button variant="bordered" onPress={() => setIsTrashModalOpen(true)}>
            Lixeira
          </Button>
          <Button
            color="primary"
            startContent={<Download className="h-4 w-4" />}
            onPress={onExportLivro}
            isDisabled={!onExportLivro}
          >
            Exportar Livro
          </Button>
        </div>
      </div>

      <FinanceiroKPIs kpis={kpis} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          isPressable
          onPress={() => setActivePendingPanel((prev) => (prev === 'receber' ? 'all' : 'receber'))}
          className={`border ${
            activePendingPanel === 'receber'
              ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20'
          }`}
        >
          <CardBody>
            <p className="text-sm text-slate-700 dark:text-slate-400 font-medium mb-1">
              CONTAS A RECEBER
            </p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {formatCurrency(aReceber)}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {receivableTransactions.length} lançamento(s) pendente(s)
            </p>
          </CardBody>
        </Card>
        <Card
          isPressable
          onPress={() => setActivePendingPanel((prev) => (prev === 'pagar' ? 'all' : 'pagar'))}
          className={`border ${
            activePendingPanel === 'pagar'
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20'
          }`}
        >
          <CardBody>
            <p className="text-sm text-slate-700 dark:text-slate-400 font-medium mb-1">
              CONTAS A PAGAR
            </p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {formatCurrency(aPagar)}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {payableTransactions.length} lançamento(s) pendente(s)
            </p>
          </CardBody>
        </Card>
      </div>

      {activePendingPanel !== 'all' && (
        <Card className="border border-default-200/50 dark:border-default-100/20">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {activePendingPanel === 'receber'
                ? 'Lançamentos de Contas a Receber'
                : activePendingPanel === 'pagar'
                  ? 'Lançamentos de Contas a Pagar'
                  : activePendingPanel === 'receita'
                    ? 'Lançamentos que compõem a Receita do Período'
                    : 'Lançamentos que compõem as Despesas do Período'}
            </h3>
            <Button
              variant="light"
              size="sm"
              onPress={() => setActivePendingPanel('all')}
              className="w-full sm:w-auto"
            >
              Limpar filtro
            </Button>
          </CardHeader>
        <CardBody>
            <div className="w-full overflow-x-auto">
              <Table aria-label="Tabela de baixa rápida" removeWrapper className="min-w-[680px]">
                <TableHeader>
                  <TableColumn className="w-16">
                    <Checkbox
                      isSelected={isAllPanelTransactionsSelected}
                      onValueChange={toggleAllPanelTransactions}
                      aria-label="Selecionar lançamentos do painel"
                      isDisabled={panelTransactions.length === 0}
                    />
                  </TableColumn>
                  <TableColumn>Vencimento</TableColumn>
                  <TableColumn>Descrição</TableColumn>
                  <TableColumn className="text-right">Valor</TableColumn>
                  <TableColumn className="text-right">Ação</TableColumn>
                </TableHeader>
                <TableBody
                  emptyContent={
                    activePendingPanel === 'receber' || activePendingPanel === 'pagar'
                      ? 'Nenhum lançamento pendente encontrado'
                      : 'Nenhum lançamento encontrado para este indicador'
                  }
                >
                  {panelTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <Checkbox
                          isSelected={selectedTransactionSet.has(transaction.id)}
                          onValueChange={(checked) =>
                            toggleTransactionSelection(transaction.id, checked)
                          }
                          aria-label={`Selecionar lançamento ${transaction.history}`}
                        />
                      </TableCell>
                      <TableCell>
                        {formatLocalDate(transaction.raw.due_date)}
                      </TableCell>
                      <TableCell>{transaction.history}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(transaction.value)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isDuePaymentStatus(transaction.status) ? (
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            onPress={() => setPendingBaixaTransaction(transaction.raw)}
                          >
                            Baixa
                          </Button>
                        ) : (
                          <span className="text-xs text-default-500">
                            {getPaymentStatusLabel(transaction.status)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Honorários dos Clientes
            </h3>
            <p className="text-sm text-default-500">
              Total listado: {formatCurrency(totalHonorarios)} em {honorariosTransactions.length}{' '}
              lançamento(s)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="bordered"
              onPress={() =>
                refreshFeePreview().catch(() => {
                  toast.error('Não foi possível atualizar a prévia.');
                })
              }
              isLoading={isLoadingFeePreview}
            >
              Atualizar prévia
            </Button>
            <Button color="primary" variant="flat" onPress={handleGenerateFees}>
              Gerar honorários
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-default-200/60 bg-default-50/60 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-default-500">Competência</p>
              <p className="text-lg font-semibold text-default-800">
                {formatMonthYear(`${monthFilter || getCurrentMonthValue()}-01`)}
              </p>
            </div>
            <div className="rounded-lg border border-default-200/60 bg-default-50/60 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-default-500">Prévia</p>
              <p className="text-lg font-semibold text-default-800">
                {feePreview ? feePreview.would_generate_count : 0} cliente(s)
              </p>
            </div>
            <div className="rounded-lg border border-default-200/60 bg-default-50/60 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-default-500">Entradas faltantes</p>
              <p className="text-lg font-semibold text-default-800">
                {feePreview ? feePreview.would_generate_entries : 0}
              </p>
            </div>
            <div className="rounded-lg border border-default-200/60 bg-default-50/60 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-default-500">Bloqueados</p>
              <p className="text-lg font-semibold text-default-800">
                {feePreview ? feePreview.blocked_count : 0}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-default-200/60 bg-default-50/60 px-3 py-3 text-sm text-default-600">
            <p>
              Competência automática:{' '}
              <strong>{formatMonthYear(`${monthFilter || getCurrentMonthValue()}-01`)}</strong>
            </p>
            {isLoadingFeePreview ? (
              <p>Carregando prévia corrigida dos honorários...</p>
            ) : feePreview ? (
              <>
                <p>
                  A prévia aponta <strong>{feePreview.would_generate_entries}</strong> entrada(s)
                  faltante(s) para <strong>{feePreview.would_generate_count}</strong> cliente(s),
                  somando <strong>{formatCurrency(feePreview.total_amount)}</strong>.
                </p>
                <p>
                  Clientes com competência bloqueada nesta data: <strong>{feePreview.blocked_count}</strong>.
                </p>
              </>
            ) : (
              <p>Não foi possível carregar a prévia dos honorários.</p>
            )}
          </div>
          <Accordion variant="splitted">
            <AccordionItem
              key="tabela-honorarios-clientes"
              aria-label="Tabela detalhada de honorários dos clientes"
              title={
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium text-default-700">
                    Tabela detalhada de honorários
                  </span>
                  <span className="text-xs text-default-500">
                    {honorariosTransactions.length} lançamento(s)
                  </span>
                </div>
              }
            >
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-default-600">
                  Selecionados: <strong>{selectedHonorariosIds.length}</strong> honorário(s)
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="bordered"
                    onPress={() => toggleAllHonorariosSelection(!isAllHonorariosSelected)}
                    isDisabled={honorariosTransactions.length === 0 || isDeletingHonorarios}
                  >
                    {isAllHonorariosSelected ? 'Desmarcar todos' : 'Marcar todos'}
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    onPress={handleBulkDeleteHonorarios}
                    isDisabled={selectedHonorariosIds.length === 0 || isDeletingHonorarios}
                    isLoading={isDeletingHonorarios}
                  >
                    Excluir selecionados
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    onPress={() => setSelectedHonorariosIds([])}
                    isDisabled={selectedHonorariosIds.length === 0 || isDeletingHonorarios}
                  >
                    Limpar seleção
                  </Button>
                </div>
              </div>
              <div className="w-full overflow-x-auto">
                <Table
                  aria-label="Tabela detalhada de honorários do escritório"
                  removeWrapper
                  className="min-w-[1160px]"
                >
                  <TableHeader>
                    <TableColumn className="w-16">
                      <Checkbox
                        isSelected={isAllHonorariosSelected}
                        onValueChange={toggleAllHonorariosSelection}
                        aria-label="Selecionar todos os honorários"
                        isDisabled={honorariosTransactions.length === 0}
                      />
                    </TableColumn>
                    <TableColumn>Competência</TableColumn>
                    <TableColumn>Cliente</TableColumn>
                    <TableColumn>CNPJ</TableColumn>
                    <TableColumn>Vencimento</TableColumn>
                    <TableColumn className="text-right">Valor</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Pagamento</TableColumn>
                    <TableColumn>Data Baixa</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="Nenhum honorário encontrado para o período selecionado">
                    {honorariosTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <Checkbox
                            isSelected={selectedHonorariosSet.has(transaction.id)}
                            onValueChange={(checked) =>
                              toggleHonorariosSelection(transaction.id, checked)
                            }
                            aria-label={`Selecionar honorário ${transaction.cliente}`}
                          />
                        </TableCell>
                        <TableCell>{transaction.competenciaLabel}</TableCell>
                        <TableCell>{transaction.cliente}</TableCell>
                        <TableCell>{transaction.cnpj}</TableCell>
                        <TableCell>
                          {formatLocalDate(transaction.dueDate)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell>{getPaymentStatusLabel(transaction.paymentStatus)}</TableCell>
                        <TableCell>
                          {transaction.paymentMethod
                            ? getPaymentMethodLabel(transaction.paymentMethod)
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {transaction.paidDate
                            ? formatLocalDate(transaction.paidDate)
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AccordionItem>
          </Accordion>
        </CardBody>
      </Card>

      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Saldo de Bancos e Caixa
            </h3>
            <p className="text-sm text-default-500">Gerencie as contas bancárias do escritório</p>
          </div>
          <Button
            color="primary"
            variant="flat"
            startContent={<Plus className="h-4 w-4" />}
            onPress={() => openBankModal()}
            className="w-full sm:w-auto"
          >
            Novo Banco
          </Button>
        </CardHeader>
        <CardBody>
          {isLoadingBanks ? (
            <p className="text-sm text-default-500">Carregando bancos...</p>
          ) : bankAccounts.length === 0 ? (
            <p className="text-sm text-default-500">Nenhum banco cadastrado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {bankAccounts.map((bank) => (
                <Card key={bank.id} className="bg-slate-50 dark:bg-slate-900/20">
                  <CardBody className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{bank.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                          Conta: {bank.account_number}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          aria-label="Editar banco"
                          onPress={() => openBankModal(bank)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          color="danger"
                          isIconOnly
                          aria-label="Excluir banco"
                          onPress={() => handleDeleteBank(bank.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(bank.balance || 0)}
                    </p>
                    {bank.accounting_account && (
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        Conta contábil: {bank.accounting_account}
                      </p>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Novo lançamento
          </h3>
          <Button
            variant="bordered"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onPress={() => setIsHistoryModalOpen(true)}
            className="w-full sm:w-auto"
          >
            Novo Histórico
          </Button>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <DatePickerField
              label="Data"
              value={newTransaction.date}
              onChange={(value) => setNewTransaction((prev) => ({ ...prev, date: value }))}
            />
            <Select
              label="Tipo"
              selectedKeys={[newTransaction.type]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as DisplayTransactionType | undefined;
                if (value) {
                  setNewTransaction((prev) => ({ ...prev, type: value, history: '' }));
                }
              }}
            >
              <SelectItem key="Entrada">Entrada</SelectItem>
              <SelectItem key="Saída">Saída</SelectItem>
            </Select>
            <Select
              label="Banco"
              selectedKeys={newTransaction.bank ? [newTransaction.bank] : []}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string | undefined;
                if (value) {
                  setNewTransaction((prev) => ({ ...prev, bank: value }));
                }
              }}
              placeholder="Selecione..."
            >
              {bankAccounts.map((bank) => (
                <SelectItem key={bank.id}>{bank.name}</SelectItem>
              ))}
            </Select>
            <Select
              label="Histórico"
              selectedKeys={newTransaction.history ? [newTransaction.history] : []}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string | undefined;
                setNewTransaction((prev) => ({ ...prev, history: value ?? '' }));
              }}
              placeholder="Selecione..."
            >
              {standardHistories
                .filter((history) =>
                  newTransaction.type === 'Entrada'
                    ? history.type === 'income'
                    : history.type === 'expense'
                )
                .map((history) => (
                  <SelectItem key={history.description}>
                    {history.description}
                    {history.accountingAccount ? ` (${history.accountingAccount})` : ''}
                  </SelectItem>
                ))}
            </Select>
            <Input
              type="number"
              label="Valor"
              placeholder="0,00"
              step="0.01"
              min="0"
              value={newTransaction.value}
              onValueChange={(value) => setNewTransaction((prev) => ({ ...prev, value }))}
            />
            <div className="flex flex-col justify-center">
              <Checkbox
                isSelected={newTransaction.isRecurring}
                onValueChange={(checked) =>
                  setNewTransaction((prev) => ({
                    ...prev,
                    isRecurring: checked,
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
            value={newTransaction.observation}
            onValueChange={(value) =>
              setNewTransaction((prev) => ({ ...prev, observation: value }))
            }
            minRows={2}
          />

          {newTransaction.isRecurring && (
            <Input
              type="number"
              label="Dia de Recorrência"
              min={1}
              max={31}
              value={String(newTransaction.recurringDay)}
              onValueChange={(value) =>
                setNewTransaction((prev) => ({
                  ...prev,
                  recurringDay: Number.parseInt(value || '1', 10),
                }))
              }
              className="w-32"
            />
          )}

          <div className="flex justify-end">
            <Button color="primary" onPress={handleAddTransaction}>
              + Lançar
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardBody>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-default-600">
              Selecionados: <strong>{selectedTransactionIds.length}</strong> lançamento(s)
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="bordered"
                onPress={() => toggleAllTransactionsOnPage(!isAllTransactionsOnPageSelected)}
                isDisabled={paginatedDisplayTransactions.length === 0 || isBulkUpdatingTransactions}
              >
                {isAllTransactionsOnPageSelected ? 'Desmarcar página' : 'Marcar página'}
              </Button>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={() => void handleBulkUpdateTransactions(PaymentStatus.PAGO)}
                isDisabled={selectedTransactionIds.length === 0 || isBulkUpdatingTransactions}
                isLoading={isBulkUpdatingTransactions}
              >
                Marcar pagos
              </Button>
              <Button
                size="sm"
                variant="flat"
                onPress={() => void handleBulkUpdateTransactions(PaymentStatus.PENDENTE)}
                isDisabled={selectedTransactionIds.length === 0 || isBulkUpdatingTransactions}
                isLoading={isBulkUpdatingTransactions}
              >
                Desmarcar baixa
              </Button>
              <Button
                size="sm"
                color="danger"
                variant="flat"
                onPress={handleBulkDeleteTransactions}
                isDisabled={selectedTransactionIds.length === 0 || isBulkUpdatingTransactions}
                isLoading={isBulkUpdatingTransactions}
              >
                Excluir em massa
              </Button>
              <Button
                size="sm"
                variant="light"
                onPress={() => setSelectedTransactionIds([])}
                isDisabled={selectedTransactionIds.length === 0 || isBulkUpdatingTransactions}
              >
                Limpar seleção
              </Button>
            </div>
          </div>
          <div className="w-full overflow-x-auto">
            <Table
              aria-label="Tabela de lançamentos do escritório"
              removeWrapper
              className="min-w-[1040px]"
            >
              <TableHeader>
                <TableColumn className="w-16">
                  <Checkbox
                    isSelected={isAllTransactionsOnPageSelected}
                    onValueChange={toggleAllTransactionsOnPage}
                    aria-label="Selecionar todos os lançamentos da página"
                    isDisabled={paginatedDisplayTransactions.length === 0}
                  />
                </TableColumn>
                <TableColumn>Data</TableColumn>
                <TableColumn>Tipo</TableColumn>
                <TableColumn>Banco</TableColumn>
                <TableColumn>Histórico</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Observação</TableColumn>
                <TableColumn className="text-right">Valor</TableColumn>
                <TableColumn className="text-right">Ações</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Nenhum lançamento cadastrado">
                {paginatedDisplayTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <Checkbox
                        isSelected={selectedTransactionSet.has(transaction.id)}
                        onValueChange={(checked) =>
                          toggleTransactionSelection(transaction.id, checked)
                        }
                        aria-label={`Selecionar lançamento ${transaction.history}`}
                      />
                    </TableCell>
                    <TableCell>{formatLocalDate(transaction.date)}</TableCell>
                    <TableCell>{transaction.type}</TableCell>
                    <TableCell>{transaction.bank || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {transaction.history}
                        {transaction.isRecurring && (
                          <Repeat
                            className="h-4 w-4 text-primary-600"
                            aria-label="Lançamento recorrente"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getPaymentStatusLabel(transaction.status)}</TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                      {transaction.observation ?? '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(transaction.value)}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {isDuePaymentStatus(transaction.status) && (
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => setPendingBaixaTransaction(transaction.raw)}
                        >
                          Baixa
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="light"
                        isIconOnly
                        aria-label="Editar lançamento"
                        onPress={() => openEditTransaction(transaction.raw)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        isIconOnly
                        aria-label="Excluir lançamento"
                        isDisabled={
                          transaction.raw.client_id === OFFICE_CLIENT_ID &&
                          transaction.raw.description.startsWith('Honorários -')
                        }
                        onPress={() => setPendingDeleteTransaction(transaction.raw)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-default-500">{transactionRangeLabel}</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="bordered"
                onPress={() => setTransactionsPage((prev) => Math.max(1, prev - 1))}
                isDisabled={transactionsPage <= 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-default-600">
                Página {transactionsPage} de {totalTransactionPages}
              </span>
              <Button
                size="sm"
                variant="bordered"
                onPress={() =>
                  setTransactionsPage((prev) => Math.min(totalTransactionPages, prev + 1))
                }
                isDisabled={transactionsPage >= totalTransactionPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Modal
        isOpen={isBankModalOpen}
        onOpenChange={(open) => {
          setIsBankModalOpen(open);
          if (!open) resetBankForm();
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{editingBank ? 'Editar Banco' : 'Adicionar Banco'}</ModalHeader>
              <ModalBody className="space-y-3">
                <Input
                  label="Nome do Banco"
                  placeholder="Ex: Banco do Brasil"
                  value={bankForm.name}
                  onValueChange={(value) => setBankForm((prev) => ({ ...prev, name: value }))}
                />
                <Input
                  label="Número da Conta"
                  placeholder="Ex: 12345-6"
                  value={bankForm.account_number}
                  onValueChange={(value) =>
                    setBankForm((prev) => ({ ...prev, account_number: value }))
                  }
                />
                <Input
                  label="Saldo"
                  type="number"
                  placeholder="0,00"
                  step="0.01"
                  min="0"
                  value={bankForm.balance}
                  onValueChange={(value) => setBankForm((prev) => ({ ...prev, balance: value }))}
                />
                <Input
                  label="Conta Contábil"
                  placeholder="Ex: 1.1.1.01"
                  value={bankForm.accounting_account}
                  onValueChange={(value) =>
                    setBankForm((prev) => ({ ...prev, accounting_account: value }))
                  }
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={isSavingBank}>
                  Cancelar
                </Button>
                <Button color="primary" onPress={handleSaveBank} isLoading={isSavingBank}>
                  {isSavingBank ? 'Salvando...' : 'Salvar'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal
        isOpen={successModal.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSuccessModal({ isOpen: false, message: '', bankName: '' });
          }
        }}
        size="sm"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalBody className="py-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  {successModal.message}
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  <span className="font-medium">{successModal.bankName}</span> foi salvo com sucesso
                  no sistema.
                </p>
              </ModalBody>
              <ModalFooter className="justify-center pb-6">
                <Button color="primary" onPress={onClose}>
                  Entendido
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Adicionar Histórico Padrão</ModalHeader>
              <ModalBody className="space-y-3">
                <Input
                  label="Descrição *"
                  placeholder="Ex: Comissão de vendas"
                  value={newHistory.description}
                  onValueChange={(value) =>
                    setNewHistory((prev) => ({ ...prev, description: value }))
                  }
                />
                <Select
                  label="Tipo *"
                  selectedKeys={[newHistory.type]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as 'income' | 'expense' | undefined;
                    setNewHistory((prev) => ({ ...prev, type: value ?? 'income' }));
                  }}
                >
                  <SelectItem key="income">Receita</SelectItem>
                  <SelectItem key="expense">Despesa</SelectItem>
                </Select>
                <Input
                  label="Conta Contábil"
                  placeholder="Ex: 3.1.1.01"
                  value={newHistory.accountingAccount}
                  onValueChange={(value) =>
                    setNewHistory((prev) => ({ ...prev, accountingAccount: value }))
                  }
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="primary" onPress={handleAddHistory}>
                  Adicionar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open);
          if (!open) setEditingTransaction(null);
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Editar Lançamento</ModalHeader>
              <ModalBody className="space-y-3">
                <Input
                  label="Descrição"
                  placeholder="Ex: Honorários do mês"
                  value={editForm.description}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, description: value }))
                  }
                />
                <Input
                  label="Valor (R$)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={editForm.amount}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, amount: value }))}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Data de Vencimento
                  </label>
                  <DatePickerField
                    value={editForm.due_date}
                    onChange={(value) => setEditForm((prev) => ({ ...prev, due_date: value }))}
                    aria-label="Data de vencimento"
                  />
                </div>
                <Select
                  label="Status do Pagamento"
                  selectedKeys={[editForm.payment_status]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as PaymentStatus | undefined;
                    if (!value) return;
                    setEditForm((prev) => ({ ...prev, payment_status: value }));
                  }}
                >
                  <SelectItem key={PaymentStatus.PENDENTE}>Pendente</SelectItem>
                  <SelectItem key={PaymentStatus.PAGO}>Pago</SelectItem>
                  <SelectItem key={PaymentStatus.PARCIAL}>Parcial</SelectItem>
                  <SelectItem key={PaymentStatus.ATRASADO}>Atrasado</SelectItem>
                  <SelectItem key={PaymentStatus.CANCELADO}>Cancelado</SelectItem>
                </Select>
                <Select
                  label="Método de Pagamento"
                  selectedKeys={editForm.payment_method ? [editForm.payment_method] : []}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as PaymentMethod | undefined;
                    setEditForm((prev) => ({ ...prev, payment_method: value ?? '' }));
                  }}
                >
                  <SelectItem key={PaymentMethod.PIX}>PIX</SelectItem>
                  <SelectItem key={PaymentMethod.BOLETO}>Boleto</SelectItem>
                  <SelectItem key={PaymentMethod.TRANSFERENCIA}>Transferência</SelectItem>
                  <SelectItem key={PaymentMethod.DINHEIRO}>Dinheiro</SelectItem>
                  <SelectItem key={PaymentMethod.CARTAO_CREDITO}>Cartão de Crédito</SelectItem>
                  <SelectItem key={PaymentMethod.CARTAO_DEBITO}>Cartão de Débito</SelectItem>
                  <SelectItem key={PaymentMethod.CHEQUE}>Cheque</SelectItem>
                </Select>
                {editForm.payment_status === PaymentStatus.PAGO && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Data de Pagamento
                    </label>
                    <DatePickerField
                      value={editForm.paid_date}
                      onChange={(value) => setEditForm((prev) => ({ ...prev, paid_date: value }))}
                      aria-label="Data de pagamento"
                    />
                  </div>
                )}
                <Input
                  label="Categoria"
                  placeholder="Ex: 1.1.01"
                  value={editForm.category}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, category: value }))}
                />
                <Input
                  label="Número da Nota"
                  placeholder="Ex: NF-001/2024"
                  value={editForm.invoice_number}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, invoice_number: value }))
                  }
                />
                <Textarea
                  label="Observações"
                  placeholder="Informações adicionais..."
                  value={editForm.notes}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, notes: value }))}
                  minRows={3}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="primary" onPress={handleUpdateTransaction}>
                  Salvar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <TransactionTrashModal
        isOpen={isTrashModalOpen}
        onOpenChange={setIsTrashModalOpen}
        filters={{
          client_id: OFFICE_CLIENT_ID || undefined,
          ...(monthFilter
            ? { reference_month: monthFilter }
            : { due_date_from: startDate, due_date_to: endDate }),
        }}
        title="Lixeira do Escritório"
        onRestored={async () => {
          await refresh();
        }}
      />

      <ConfirmBaixaLancamentoDialog
        isOpen={Boolean(pendingBaixaTransaction)}
        transaction={pendingBaixaTransaction}
        isLoading={isConfirmingBaixa}
        onConfirm={handleMarkAsPaid}
        onCancel={() => {
          if (!isConfirmingBaixa) setPendingBaixaTransaction(null);
        }}
      />

      <ConfirmDeleteLancamentoDialog
        isOpen={Boolean(pendingDeleteTransaction)}
        transaction={pendingDeleteTransaction}
        isLoading={isConfirmingDelete}
        onConfirm={handleDeleteTransaction}
        onCancel={() => {
          if (!isConfirmingDelete) setPendingDeleteTransaction(null);
        }}
      />
    </div>
  );
}
