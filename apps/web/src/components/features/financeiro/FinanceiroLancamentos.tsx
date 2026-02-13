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
  getPaymentStatusColor,
  getPaymentStatusLabel,
} from '@/types/finance';
import type { ClientListItem } from '@/types/client';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { MonthYearPicker } from '@/components/ui/MonthYearPicker';
import { endOfMonth, formatISO, startOfMonth, subMonths } from 'date-fns';
import { getContaByCodigo, formatConta } from '@/constants/planoDeContas';
import { NovoLancamentoModal, type NovoLancamentoData } from './NovoLancamentoModal';
import { clientsApi } from '@/lib/api/endpoints/clients';
import { toast } from '@/lib/toast';
import { TransactionTrashModal } from './TransactionTrashModal';
import { ConfirmBaixaLancamentoDialog } from './ConfirmBaixaLancamentoDialog';
import { ConfirmDeleteLancamentoDialog } from './ConfirmDeleteLancamentoDialog';

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

const normalizeDecimalInput = (value: string): number => Number.parseFloat(value.replace(',', '.'));

export function FinanceiroLancamentos() {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [monthFilter, setMonthFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [activePendingPanel, setActivePendingPanel] = useState<'all' | 'receber' | 'pagar'>('all');
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [pendingBaixaTransaction, setPendingBaixaTransaction] = useState<Transaction | null>(null);
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState<Transaction | null>(null);
  const [isConfirmingBaixa, setIsConfirmingBaixa] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
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

  useEffect(() => {
    const now = new Date();
    setMonthFilter(formatISO(now, { representation: 'date' }).slice(0, 7));
    setStartDate(formatISO(startOfMonth(now), { representation: 'date' }));
    setEndDate(formatISO(endOfMonth(now), { representation: 'date' }));
  }, []);

  const transactionFilters = useMemo(
    () => ({
      due_date_from: startDate,
      due_date_to: endDate,
      page: 1,
      size: 100,
    }),
    [startDate, endDate]
  );

  const setRangeForMonth = (monthValue: string) => {
    if (!monthValue) return;
    const [year, month] = monthValue.split('-');
    if (!year || !month) return;
    const parsedYear = Number.parseInt(year, 10);
    const parsedMonth = Number.parseInt(month, 10);
    if (!parsedYear || !parsedMonth) return;
    const monthLabel = String(parsedMonth).padStart(2, '0');
    const lastDay = new Date(parsedYear, parsedMonth, 0).getDate();
    setStartDate(`${parsedYear}-${monthLabel}-01`);
    setEndDate(`${parsedYear}-${monthLabel}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleMonthChange = (value: string) => {
    setMonthFilter(value);
    if (value) {
      setRangeForMonth(value);
    }
  };

  const setCurrentMonthRange = () => {
    const currentMonth = formatISO(new Date(), { representation: 'date' }).slice(0, 7);
    setMonthFilter(currentMonth);
    setRangeForMonth(currentMonth);
  };

  const setPreviousMonthRange = () => {
    const previous = subMonths(new Date(), 1);
    const previousMonth = formatISO(previous, { representation: 'date' }).slice(0, 7);
    setMonthFilter(previousMonth);
    setRangeForMonth(previousMonth);
  };

  const normalizeMonthFilter = (startValue: string, endValue: string) => {
    const [startYear, startMonth, startDay] = startValue.split('-');
    const [endYear, endMonth, endDay] = endValue.split('-');
    if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
      return '';
    }
    if (startYear !== endYear || startMonth !== endMonth) {
      return '';
    }
    if (startDay !== '01') {
      return '';
    }
    const lastDay = new Date(Number(startYear), Number(startMonth), 0).getDate();
    const expectedEndDay = String(lastDay).padStart(2, '0');
    if (endDay !== expectedEndDay) {
      return '';
    }
    return `${startYear}-${startMonth}`;
  };

  useEffect(() => {
    const normalized = normalizeMonthFilter(startDate, endDate);
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
          lancamento.tipo === TransactionType.RECEITA && lancamento.status !== PaymentStatus.PAGO
      ),
    [lancamentos]
  );
  const payableLancamentos = useMemo(
    () =>
      lancamentos.filter(
        (lancamento) =>
          lancamento.tipo === TransactionType.DESPESA && lancamento.status !== PaymentStatus.PAGO
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

  const lancamentosFiltrados = useMemo(() => {
    const query = busca.trim().toLowerCase();
    return lancamentos.filter((lancamento) => {
      const matchTipo = filtroTipo === 'todos' || lancamento.tipo === filtroTipo;
      const matchStatus = filtroStatus === 'todos' || lancamento.status === filtroStatus;
      const matchPanel =
        activePendingPanel === 'all' ||
        (activePendingPanel === 'receber' &&
          lancamento.tipo === TransactionType.RECEITA &&
          lancamento.status !== PaymentStatus.PAGO) ||
        (activePendingPanel === 'pagar' &&
          lancamento.tipo === TransactionType.DESPESA &&
          lancamento.status !== PaymentStatus.PAGO);
      const matchBusca =
        query === '' ||
        lancamento.descricao.toLowerCase().includes(query) ||
        lancamento.competencia.toLowerCase().includes(query) ||
        (lancamento.categoria ?? '').toLowerCase().includes(query) ||
        (lancamento.cliente ?? '').toLowerCase().includes(query);

      return matchTipo && matchStatus && matchBusca && matchPanel;
    });
  }, [lancamentos, busca, filtroStatus, filtroTipo, activePendingPanel]);

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
    const amountValue = normalizeDecimalInput(editForm.amount);
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
      await updateTransaction(pendingBaixaTransaction.id, {
        payment_status: PaymentStatus.PAGO,
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
                className="w-[180px]"
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
                className="w-[180px]"
                aria-label="Data inicial"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Fim</label>
              <DatePickerField
                value={endDate}
                onChange={setEndDate}
                size="sm"
                className="w-[180px]"
                aria-label="Data final"
              />
            </div>
            <div className="md:ml-auto flex gap-2">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>

        <div className="rounded-lg border border-default-200/60 dark:border-default-100/20">
          <Table aria-label="Tabela de lançamentos financeiros" removeWrapper>
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
              {lancamentosFiltrados.map((lancamento) => {
                const conta = lancamento.categoria ? getContaByCodigo(lancamento.categoria) : null;
                return (
                  <TableRow key={lancamento.id}>
                    <TableCell className="font-medium">{formatDate(lancamento.data)}</TableCell>
                    <TableCell>{lancamento.descricao}</TableCell>
                    <TableCell className="text-sm">
                      {conta ? (
                        <span className="text-default-700" title={conta.descricao}>
                          {formatConta(conta)}
                        </span>
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
                        {lancamento.tipo === TransactionType.RECEITA ? (
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
                      {lancamento.status !== PaymentStatus.PAGO && (
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => setPendingBaixaTransaction(lancamento.raw)}
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
                        onPress={() => setPendingDeleteTransaction(lancamento.raw)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
            due_date_from: startDate,
            due_date_to: endDate,
          }}
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
