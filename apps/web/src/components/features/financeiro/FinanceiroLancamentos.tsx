'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDisclosure } from '@heroui/react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
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
  Skeleton,
  Textarea,
} from '@/heroui';
import { ArrowDownRight, ArrowUpRight, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import {
  PaymentMethod,
  PaymentStatus,
  TransactionType,
  type Transaction,
  type TransactionUpdate,
  isAutomaticMonthlyFeeTransaction,
  isDuePaymentStatus,
  isProfitDistributionTransaction,
  getPaymentStatusColor,
  getPaymentStatusLabel,
} from '@/types/finance';
import type { ClientListItem } from '@/types/client';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { MonthYearPicker } from '@/components/ui/MonthYearPicker';
import { resolveCategoriaLancamento } from '@/constants/planoDeContas';
import { NovoLancamentoModal, type NovoLancamentoData } from './NovoLancamentoModal';
import { clientsApi } from '@/lib/api/endpoints/clients';
import { financeApi } from '@/lib/api/endpoints/finance';
import { toast } from '@/lib/toast';
import { TransactionTrashModal } from './TransactionTrashModal';
import { ConfirmBaixaLancamentoDialog } from './ConfirmBaixaLancamentoDialog';
import { ConfirmDeleteLancamentoDialog } from './ConfirmDeleteLancamentoDialog';
import { PlanoDeContasAutocomplete } from '@/components/ui/PlanoDeContasAutocomplete';
import { normalizeAmountForRequest } from '@/lib/finance/amount';
import {
  buildDateRangeForMonth,
  getCurrentMonthFilterState,
  getPreviousMonthFilterState,
  normalizeMonthFilterFromRange,
} from '@/lib/finance/month-filter';

type LancamentoTipo = TransactionType;
type LancamentoStatus = PaymentStatus;

interface Lancamento {
  id: string;
  data: string;
  descricao: string;
  competencia: string;
  categoria?: string | null;
  tipo: LancamentoTipo;
  valor: number;
  status: LancamentoStatus;
  cliente?: string;
  pagamento?: string;
  raw: Transaction;
}

const LANCAMENTOS_PER_PAGE = 20;
const MAX_CUSTOM_CATEGORY_LENGTH = 20;
const OFFICE_CLIENT_ID = process.env.NEXT_PUBLIC_OFFICE_CLIENT_ID ?? '';
const PROFIT_DISTRIBUTION_LABEL = 'Distribuição de lucros';

export function FinanceiroLancamentos() {
  const initialMonthFilterState = getCurrentMonthFilterState();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [monthFilter, setMonthFilter] = useState(initialMonthFilterState.monthFilter);
  const [startDate, setStartDate] = useState(initialMonthFilterState.startDate);
  const [endDate, setEndDate] = useState(initialMonthFilterState.endDate);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [activePendingPanel, setActivePendingPanel] = useState<
    'all' | 'receber' | 'pagar' | 'distribuicao'
  >('all');
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [pendingBaixaTransaction, setPendingBaixaTransaction] = useState<Transaction | null>(null);
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState<Transaction | null>(
    null
  );
  const [isConfirmingBaixa, setIsConfirmingBaixa] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [lancamentosPage, setLancamentosPage] = useState(1);
  const [editForm, setEditForm] = useState({
    description: '',
    amount: '',
    due_date: '',
    payment_status: PaymentStatus.PENDENTE,
    payment_method: '' as PaymentMethod | '',
    paid_date: '',
    category: '',
    category_mode: 'plano' as 'plano' | 'custom',
    custom_category: '',
    notes: '',
    invoice_number: '',
  });

  const transactionFilters = useMemo(
    () => ({
      ...(monthFilter
        ? { reference_month: monthFilter }
        : { due_date_from: startDate, due_date_to: endDate }),
      page: 1,
      size: 100,
    }),
    [monthFilter, startDate, endDate]
  );

  const setRangeForMonth = (monthValue: string) => {
    const { startDate: nextStartDate, endDate: nextEndDate } = buildDateRangeForMonth(monthValue);
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
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

  useEffect(() => {
    const normalized = normalizeMonthFilterFromRange(startDate, endDate);
    if (normalized && normalized !== monthFilter) {
      setMonthFilter(normalized);
    }
    if (!normalized && monthFilter) {
      setMonthFilter('');
    }
  }, [startDate, endDate, monthFilter]);

  // Carregar clientes imediatamente ao montar o componente
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        // Sempre tenta carregar a lista completa primeiro
        const response = await clientsApi.list({ size: 0 });
        if (active) setClients(response.items);
      } catch (error) {
        // Se falhar (ex: usuário é cliente), tenta carregar apenas o próprio cliente
        try {
          const client = await clientsApi.getMe();
          if (active) setClients([client]);
        } catch (innerError) {
          console.error('Erro ao carregar clientes:', innerError);
          toast.error('Não foi possível carregar os clientes.');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Fetch transactions from API
  const {
    transactions,
    isLoading,
    fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    refresh,
  } = useTransactions({
    filters: transactionFilters,
    autoFetch: Boolean(startDate && endDate),
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleRefresh = () => {
      refresh().catch((error) => {
        console.error('Erro ao atualizar lista de lançamentos', error);
      });
    };
    window.addEventListener('finance:transactions-updated', handleRefresh);
    return () => {
      window.removeEventListener('finance:transactions-updated', handleRefresh);
    };
  }, [refresh]);

  const handleSaveTransaction = async (data: NovoLancamentoData) => {
    try {
      await createTransaction(data);
      toast.success('Lançamento salvo com sucesso.');

      // Recarregar dados
      await fetchTransactions(transactionFilters);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
    } catch (error) {
      console.error('Erro ao salvar lançamento:', error);
      const errorDetail = (error as { data?: { detail?: string } })?.data?.detail;
      const message =
        typeof errorDetail === 'string' ? errorDetail : 'Não foi possível salvar o lançamento.';
      toast.error(message);
      throw error;
    }
  };

  const lancamentos = useMemo<Lancamento[]>(() => {
    return transactions.map((transaction) => ({
      id: transaction.id,
      data: transaction.paid_date || transaction.due_date,
      descricao: transaction.description ?? '',
      competencia: transaction.reference_month ?? '',
      categoria: transaction.category ?? null,
      tipo: transaction.transaction_type,
      valor: transaction.amount,
      status: transaction.payment_status,
      cliente: transaction.client_name ?? transaction.client_cnpj ?? undefined,
      pagamento: transaction.payment_method ?? undefined,
      raw: transaction,
    }));
  }, [transactions]);

  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        id: client.id,
        name: `${client.nome_fantasia || client.razao_social} — ${client.cnpj}`,
      })),
    [clients]
  );

  const receivableLancamentos = useMemo(
    () =>
      lancamentos.filter(
        (lancamento) =>
          lancamento.tipo === TransactionType.RECEITA && isDuePaymentStatus(lancamento.status)
      ),
    [lancamentos]
  );
  const payableLancamentos = useMemo(
    () =>
      lancamentos.filter(
        (lancamento) =>
          lancamento.tipo === TransactionType.DESPESA && isDuePaymentStatus(lancamento.status)
      ),
    [lancamentos]
  );
  const paidProfitDistributionLancamentos = useMemo(
    () =>
      lancamentos.filter(
        (lancamento) =>
          isProfitDistributionTransaction(lancamento.raw) &&
          lancamento.status === PaymentStatus.PAGO
      ),
    [lancamentos]
  );
  const totalReceber = useMemo(
    () => receivableLancamentos.reduce((sum, lancamento) => sum + lancamento.valor, 0),
    [receivableLancamentos]
  );
  const totalPagar = useMemo(
    () => payableLancamentos.reduce((sum, lancamento) => sum + lancamento.valor, 0),
    [payableLancamentos]
  );
  const totalDistribuicaoLucros = useMemo(
    () => paidProfitDistributionLancamentos.reduce((sum, lancamento) => sum + lancamento.valor, 0),
    [paidProfitDistributionLancamentos]
  );

  const lancamentosFiltrados = useMemo(() => {
    const query = busca.trim().toLowerCase();
    return lancamentos.filter((lancamento) => {
      const matchTipo = filtroTipo === 'todos' || lancamento.tipo === filtroTipo;
      const matchStatus = filtroStatus === 'todos' || lancamento.status === filtroStatus;
      const matchPanel =
        activePendingPanel === 'all' ||
        (activePendingPanel === 'receber' &&
          lancamento.tipo === TransactionType.RECEITA &&
          isDuePaymentStatus(lancamento.status)) ||
        (activePendingPanel === 'pagar' &&
          lancamento.tipo === TransactionType.DESPESA &&
          isDuePaymentStatus(lancamento.status)) ||
        (activePendingPanel === 'distribuicao' &&
          isProfitDistributionTransaction(lancamento.raw) &&
          lancamento.status === PaymentStatus.PAGO);
      const categoriaInfo = resolveCategoriaLancamento(lancamento.categoria);
      const categoriaSearchText = `${lancamento.categoria ?? ''} ${categoriaInfo?.label ?? ''} ${
        categoriaInfo?.conta?.descricao ?? ''
      }`.toLowerCase();
      const matchBusca =
        query === '' ||
        lancamento.descricao.toLowerCase().includes(query) ||
        lancamento.competencia.toLowerCase().includes(query) ||
        categoriaSearchText.includes(query) ||
        (lancamento.cliente ?? '').toLowerCase().includes(query);

      return matchTipo && matchStatus && matchBusca && matchPanel;
    });
  }, [lancamentos, busca, filtroStatus, filtroTipo, activePendingPanel]);

  useEffect(() => {
    setLancamentosPage(1);
  }, [startDate, endDate, busca, filtroTipo, filtroStatus, activePendingPanel]);

  const totalLancamentosPages = useMemo(() => {
    if (lancamentosFiltrados.length === 0) return 1;
    return Math.ceil(lancamentosFiltrados.length / LANCAMENTOS_PER_PAGE);
  }, [lancamentosFiltrados.length]);

  useEffect(() => {
    if (lancamentosPage > totalLancamentosPages) {
      setLancamentosPage(totalLancamentosPages);
    }
  }, [lancamentosPage, totalLancamentosPages]);

  const lancamentosPaginados = useMemo(() => {
    const startIndex = (lancamentosPage - 1) * LANCAMENTOS_PER_PAGE;
    const endIndex = startIndex + LANCAMENTOS_PER_PAGE;
    return lancamentosFiltrados.slice(startIndex, endIndex);
  }, [lancamentosFiltrados, lancamentosPage]);

  const lancamentosRangeLabel = useMemo(() => {
    if (lancamentosFiltrados.length === 0) {
      return 'Mostrando 0 de 0';
    }
    const startIndex = (lancamentosPage - 1) * LANCAMENTOS_PER_PAGE + 1;
    const endIndex = Math.min(lancamentosPage * LANCAMENTOS_PER_PAGE, lancamentosFiltrados.length);
    return `Mostrando ${startIndex}-${endIndex} de ${lancamentosFiltrados.length}`;
  }, [lancamentosFiltrados.length, lancamentosPage]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  const formatDate = (date?: string | null) => {
    if (!date) return '-';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('pt-BR');
  };

  const formatCompetencia = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(parsed);
  };

  const normalizeDateInput = (value?: string | null): string => {
    if (!value) return '';
    const [datePart] = value.split('T');
    return datePart ?? '';
  };

  const isAutomaticFee = (transaction: Transaction) =>
    isAutomaticMonthlyFeeTransaction(transaction, OFFICE_CLIENT_ID || undefined);

  const openEditTransaction = (transaction: Transaction) => {
    if (isAutomaticFee(transaction)) {
      toast.error('Honorários automáticos devem ser geridos pela aba Escritório.');
      return;
    }
    const resolvedCategory = resolveCategoriaLancamento(transaction.category);
    const isCustomCategory = Boolean(resolvedCategory?.isCustom);
    const categoryValue = transaction.category ?? '';

    setEditingTransaction(transaction);
    setEditForm({
      description: transaction.description ?? '',
      amount: transaction.amount?.toString() ?? '',
      due_date: normalizeDateInput(transaction.due_date),
      payment_status: transaction.payment_status ?? PaymentStatus.PENDENTE,
      payment_method: transaction.payment_method ?? '',
      paid_date: normalizeDateInput(transaction.paid_date),
      category: isCustomCategory ? '' : categoryValue,
      category_mode: isCustomCategory ? 'custom' : 'plano',
      custom_category: isCustomCategory ? categoryValue : '',
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

    let normalizedCategory: string | null = null;
    if (editForm.category_mode === 'custom') {
      const customCategory = editForm.custom_category.trim();
      if (!customCategory) {
        toast.error('Informe a categoria personalizada.');
        return;
      }
      if (customCategory.length > MAX_CUSTOM_CATEGORY_LENGTH) {
        toast.error(
          `A categoria personalizada deve ter até ${MAX_CUSTOM_CATEGORY_LENGTH} caracteres.`
        );
        return;
      }
      normalizedCategory = customCategory;
    } else {
      normalizedCategory = editForm.category.trim() || null;
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
      category: normalizedCategory,
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
      console.error('Erro ao atualizar lançamento:', error);
      toast.error('Não foi possível atualizar o lançamento.');
    }
  };

  const handleDeleteTransaction = async () => {
    if (!pendingDeleteTransaction) return;
    try {
      setIsConfirmingDelete(true);
      await deleteTransaction(pendingDeleteTransaction.id);
      toast.success('Lançamento removido com sucesso.');
      await refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
      setPendingDeleteTransaction(null);
    } catch (error) {
      console.error('Erro ao remover lançamento:', error);
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
      await financeApi.markAsPaid(pendingBaixaTransaction.id, {
        payment_method: paymentMethod,
        paid_date: new Date().toISOString(),
      });
      toast.success('Baixa realizada com sucesso.');
      await refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:transactions-updated'));
      }
      setPendingBaixaTransaction(null);
    } catch (error) {
      console.error('Erro ao baixar lançamento:', error);
      toast.error('Não foi possível realizar a baixa.');
    } finally {
      setIsConfirmingBaixa(false);
    }
  };

  const requestDeleteTransaction = (transaction: Transaction) => {
    if (isAutomaticFee(transaction)) {
      toast.error('Honorários automáticos devem ser geridos pela aba Escritório.');
      return;
    }
    setPendingDeleteTransaction(transaction);
  };

  const requestMarkAsPaid = (transaction: Transaction) => {
    if (isAutomaticFee(transaction)) {
      toast.error('Honorários automáticos devem ser geridos pela aba Escritório.');
      return;
    }
    setPendingBaixaTransaction(transaction);
  };

  if (isLoading) {
    return (
      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardBody className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border border-default-200/50 dark:border-default-100/20">
      <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Lançamentos Financeiros
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="bordered" startContent={<Download className="h-4 w-4" />}>
            Exportar
          </Button>
          <Button size="sm" variant="bordered" onPress={() => setIsTrashModalOpen(true)}>
            Lixeira
          </Button>
          <Button
            size="sm"
            color="primary"
            startContent={<Plus className="h-4 w-4" />}
            onPress={onOpen}
          >
            Novo Lançamento
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        <div className="flex flex-col gap-4">
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
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Início
              </label>
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
            <div className="md:ml-auto flex flex-wrap gap-2">
              <Button variant="bordered" onPress={setCurrentMonthRange}>
                Mês atual
              </Button>
              <Button variant="bordered" onPress={setPreviousMonthRange}>
                Mês anterior
              </Button>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-4">
            <Input
              value={busca}
              onValueChange={setBusca}
              placeholder="Buscar por descrição, categoria ou cliente..."
              startContent={<Search className="h-4 w-4 text-default-400" />}
              className="flex-1"
            />
            <Select
              selectedKeys={[filtroTipo]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string | undefined;
                setFiltroTipo(value ?? 'todos');
              }}
              labelPlacement="outside-left"
              aria-label="Filtrar por tipo"
              className="lg:w-[200px]"
            >
              <SelectItem key="todos">Todos os tipos</SelectItem>
              <SelectItem key={TransactionType.RECEITA}>Receitas</SelectItem>
              <SelectItem key={TransactionType.DESPESA}>Despesas</SelectItem>
            </Select>
            <Select
              selectedKeys={[filtroStatus]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string | undefined;
                setFiltroStatus(value ?? 'todos');
              }}
              labelPlacement="outside-left"
              aria-label="Filtrar por status"
              className="lg:w-[200px]"
            >
              <SelectItem key="todos">Todos os status</SelectItem>
              <SelectItem key={PaymentStatus.PAGO}>Pago</SelectItem>
              <SelectItem key={PaymentStatus.PENDENTE}>Pendente</SelectItem>
              <SelectItem key={PaymentStatus.ATRASADO}>Atrasado</SelectItem>
              <SelectItem key={PaymentStatus.PARCIAL}>Parcial</SelectItem>
              <SelectItem key={PaymentStatus.CANCELADO}>Cancelado</SelectItem>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            isPressable
            onPress={() =>
              setActivePendingPanel((prev) => (prev === 'receber' ? 'all' : 'receber'))
            }
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
                {formatCurrency(totalReceber)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {receivableLancamentos.length} lançamento(s) pendente(s)
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
                {formatCurrency(totalPagar)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {payableLancamentos.length} lançamento(s) pendente(s)
              </p>
            </CardBody>
          </Card>
          <Card
            isPressable
            onPress={() =>
              setActivePendingPanel((prev) => (prev === 'distribuicao' ? 'all' : 'distribuicao'))
            }
            className={`border ${
              activePendingPanel === 'distribuicao'
                ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20'
            }`}
          >
            <CardBody>
              <p className="text-sm text-slate-700 dark:text-slate-400 font-medium mb-1">
                DISTRIBUIÇÃO DE LUCROS
              </p>
              <p className="text-2xl font-bold text-sky-700 dark:text-sky-400">
                {formatCurrency(totalDistribuicaoLucros)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {paidProfitDistributionLancamentos.length} pagamento(s) no período
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="rounded-lg border border-default-200/60 dark:border-default-100/20">
          <div className="w-full overflow-x-auto">
            <Table
              aria-label="Tabela de lançamentos financeiros"
              removeWrapper
              className="min-w-[1100px]"
            >
              <TableHeader>
                <TableColumn>Data</TableColumn>
                <TableColumn>Descrição</TableColumn>
                <TableColumn>Categoria</TableColumn>
                <TableColumn>Competência</TableColumn>
                <TableColumn>Cliente</TableColumn>
                <TableColumn>Tipo</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn className="text-right">Valor</TableColumn>
                <TableColumn className="text-right">Ações</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Nenhum lançamento encontrado">
                {lancamentosPaginados.map((lancamento) => {
                  const categoriaInfo = resolveCategoriaLancamento(lancamento.categoria);
                  return (
                    <TableRow key={lancamento.id}>
                      <TableCell className="font-medium">{formatDate(lancamento.data)}</TableCell>
                      <TableCell>{lancamento.descricao}</TableCell>
                      <TableCell className="text-sm">
                        {categoriaInfo ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className="text-default-700"
                              title={categoriaInfo.conta?.descricao ?? categoriaInfo.label}
                            >
                              {categoriaInfo.label}
                            </span>
                            {categoriaInfo.isTax && (
                              <Chip size="sm" variant="flat" color="warning">
                                Imposto
                              </Chip>
                            )}
                            {categoriaInfo.isCustom && (
                              <Chip size="sm" variant="flat" color="secondary">
                                Personalizada
                              </Chip>
                            )}
                          </div>
                        ) : (
                          <span className="text-default-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                        {formatCompetencia(lancamento.competencia)}
                      </TableCell>
                      <TableCell className="text-sm">{lancamento.cliente ?? '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {isProfitDistributionTransaction(lancamento.raw) ? (
                            <span className="text-sm text-sky-600">
                              {PROFIT_DISTRIBUTION_LABEL}
                            </span>
                          ) : lancamento.tipo === TransactionType.RECEITA ? (
                            <>
                              <ArrowUpRight className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-green-600">Receita</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownRight className="h-4 w-4 text-red-600" />
                              <span className="text-sm text-red-600">Despesa</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip
                          color={getPaymentStatusColor(lancamento.status)}
                          variant="flat"
                          size="sm"
                        >
                          {getPaymentStatusLabel(lancamento.status)}
                        </Chip>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <span
                          className={
                            lancamento.tipo === TransactionType.RECEITA
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {formatCurrency(lancamento.valor)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {isAutomaticFee(lancamento.raw) ? (
                          <span className="text-xs text-default-500">
                            Gerencie na aba Escritório
                          </span>
                        ) : (
                          <>
                            {isDuePaymentStatus(lancamento.status) && (
                              <Button
                                size="sm"
                                variant="flat"
                                color="primary"
                                onPress={() => requestMarkAsPaid(lancamento.raw)}
                              >
                                Baixa
                              </Button>
                            )}
                            <Button
                              variant="light"
                              size="sm"
                              isIconOnly
                              aria-label="Editar lançamento"
                              onPress={() => openEditTransaction(lancamento.raw)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="light"
                              size="sm"
                              isIconOnly
                              color="danger"
                              aria-label="Excluir lançamento"
                              onPress={() => requestDeleteTransaction(lancamento.raw)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-default-500">{lancamentosRangeLabel}</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="bordered"
                onPress={() => setLancamentosPage((prev) => Math.max(1, prev - 1))}
                isDisabled={lancamentosPage <= 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-default-600">
                Página {lancamentosPage} de {totalLancamentosPages}
              </span>
              <Button
                size="sm"
                variant="bordered"
                onPress={() =>
                  setLancamentosPage((prev) => Math.min(totalLancamentosPages, prev + 1))
                }
                isDisabled={lancamentosPage >= totalLancamentosPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>

        <NovoLancamentoModal
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          onSave={handleSaveTransaction}
          clients={clientOptions}
        />

        <Modal
          isOpen={isEditModalOpen}
          onOpenChange={(open) => {
            setIsEditModalOpen(open);
            if (!open) setEditingTransaction(null);
          }}
          size="3xl"
          scrollBehavior="inside"
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
                  <Select
                    label="Tipo de Categoria"
                    selectedKeys={[editForm.category_mode]}
                    onSelectionChange={(keys) => {
                      const mode =
                        (Array.from(keys)[0] as 'plano' | 'custom' | undefined) ?? 'plano';
                      setEditForm((prev) => ({
                        ...prev,
                        category_mode: mode,
                        custom_category:
                          mode === 'custom' && prev.custom_category.length === 0
                            ? prev.category
                            : prev.custom_category,
                      }));
                    }}
                  >
                    <SelectItem key="plano">Plano de contas (inclui impostos)</SelectItem>
                    <SelectItem key="custom">Categoria personalizada</SelectItem>
                  </Select>
                  {editForm.category_mode === 'plano' ? (
                    <PlanoDeContasAutocomplete
                      value={editForm.category || null}
                      onChange={(value) =>
                        setEditForm((prev) => ({ ...prev, category: value ?? '' }))
                      }
                      label="Categoria (Plano de Contas)"
                      placeholder="Inclui impostos federais, estaduais e municipais"
                    />
                  ) : (
                    <Input
                      label="Categoria personalizada"
                      placeholder="Ex: Imposto complementar"
                      value={editForm.custom_category}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({ ...prev, custom_category: value }))
                      }
                      maxLength={MAX_CUSTOM_CATEGORY_LENGTH}
                      description={`Até ${MAX_CUSTOM_CATEGORY_LENGTH} caracteres.`}
                    />
                  )}
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
          filters={
            monthFilter
              ? { reference_month: monthFilter }
              : {
                  due_date_from: startDate,
                  due_date_to: endDate,
                }
          }
          title="Lixeira de Lançamentos"
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
      </CardBody>
    </Card>
  );
}
