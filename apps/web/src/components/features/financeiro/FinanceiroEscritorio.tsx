'use client';

import { DatePickerField } from '@/components/ui/DatePickerField';
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
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Textarea,
} from '@/heroui';
import { DollarSign, Download, Plus, Repeat, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FinanceiroKPIs, type FinanceiroKpi } from './FinanceiroKPIs';
import { useTransactions } from '@/hooks/useTransactions';
import {
  PaymentMethod,
  PaymentStatus,
  TransactionType,
  getPaymentMethodLabel,
} from '@/types/finance';
import { toast } from '@/lib/toast';
import { endOfMonth, formatISO, startOfMonth, subMonths } from 'date-fns';
import { MonthYearPicker } from '@/components/ui/MonthYearPicker';

type DisplayTransactionType = 'Entrada' | 'Saída';

type DisplayTransaction = {
  id: string;
  date: string;
  type: DisplayTransactionType;
  bank: string;
  history: string;
  observation?: string;
  value: number;
  isRecurring?: boolean;
  recurringDay?: number;
};

type Bank = {
  id: string;
  name: string;
  accountNumber: string;
  balance: number;
  accountingAccount?: string;
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

const initialBanks: Bank[] = [
  {
    id: '1',
    name: 'Banco do Brasil',
    accountNumber: '1234-7',
    balance: 12500.5,
    accountingAccount: '1.1.1.01',
  },
  {
    id: '2',
    name: 'Caixa Econômica',
    accountNumber: '5678-9',
    balance: 6800.25,
    accountingAccount: '1.1.1.02',
  },
  {
    id: '3',
    name: 'Pagamento PIX',
    accountNumber: '0001-2',
    balance: 9800.0,
    accountingAccount: '1.1.1.03',
  },
];

const initialHistories: StandardHistory[] = [
  { id: '1', description: 'Honorários do mês', accountingAccount: '3.1.1.01', type: 'income' },
  { id: '2', description: 'Serviço extra', accountingAccount: '3.1.1.02', type: 'income' },
  { id: '3', description: 'Aluguel', accountingAccount: '2.1.1.01', type: 'expense' },
  { id: '4', description: 'Internet', accountingAccount: '2.1.1.02', type: 'expense' },
];

const buildDefaultTransaction = (): NewTransactionState => ({
  date: formatISO(new Date(), { representation: 'date' }),
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

export function FinanceiroEscritorio({ onExportLivro }: { onExportLivro?: () => void }) {
  const [monthFilter, setMonthFilter] = useState(formatISO(new Date(), { representation: 'date' }).slice(0, 7));
  const [startDate, setStartDate] = useState(
    formatISO(startOfMonth(new Date()), { representation: 'date' })
  );
  const [endDate, setEndDate] = useState(
    formatISO(endOfMonth(new Date()), { representation: 'date' })
  );
  const [banks, setBanks] = useState<Bank[]>(initialBanks);
  const [standardHistories, setStandardHistories] = useState<StandardHistory[]>(initialHistories);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [newBank, setNewBank] = useState({
    name: '',
    accountNumber: '',
    balance: '',
    accountingAccount: '',
  });
  const [newHistory, setNewHistory] = useState({
    description: '',
    accountingAccount: '',
    type: 'income' as 'income' | 'expense',
  });
  const [newTransaction, setNewTransaction] = useState<NewTransactionState>(buildDefaultTransaction());
  const OFFICE_CLIENT_ID = process.env.NEXT_PUBLIC_OFFICE_CLIENT_ID ?? '';

  const { transactions, createTransaction, deleteTransaction, refresh } = useTransactions({
    filters: {
      client_id: OFFICE_CLIENT_ID || undefined,
      due_date_from: startDate,
      due_date_to: endDate,
      page: 1,
      size: 200,
    },
    autoFetch: true,
  });

  const paidTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.payment_status === PaymentStatus.PAGO || Boolean(transaction.paid_date)
      ),
    [transactions]
  );

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
      isRecurring: false,
    }));
  }, [transactions]);

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

  const setRangeForMonth = (monthValue: string) => {
    if (!monthValue) return;
    const [year, month] = monthValue.split('-');
    const parsedYear = Number.parseInt(year, 10);
    const parsedMonth = Number.parseInt(month, 10);
    if (!parsedYear || !parsedMonth) return;
    const monthLabel = String(parsedMonth).padStart(2, '0');
    const lastDay = new Date(parsedYear, parsedMonth, 0).getDate();
    setStartDate(`${parsedYear}-${monthLabel}-01`);
    setEndDate(`${parsedYear}-${monthLabel}-${String(lastDay).padStart(2, '0')}`);
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

  const handleMonthChange = (value: string) => {
    setMonthFilter(value);
    if (value) {
      setRangeForMonth(value);
    }
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

  const kpis: FinanceiroKpi[] = [
    {
      title: 'Receita do Período',
      value: formatCurrency(receita),
      change: '+4,2% vs mês anterior',
      trend: 'up',
      icon: DollarSign,
      colorClass: 'text-green-600',
      backgroundClass: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      title: 'Despesas',
      value: formatCurrency(despesa),
      change: '+1,8% vs mês anterior',
      trend: 'up',
      icon: TrendingDown,
      colorClass: 'text-amber-600',
      backgroundClass: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
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
      toast.error('Configure o ID do escritório (NEXT_PUBLIC_OFFICE_CLIENT_ID) para lançar receitas/despesas.');
      return;
    }

    const amount = Number.parseFloat(newTransaction.value);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    const bankName = banks.find((bank) => bank.id === newTransaction.bank)?.name;
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
        payment_method: bankName
          ? bankName.toLowerCase().includes('pix')
            ? PaymentMethod.PIX
            : PaymentMethod.TRANSFERENCIA
          : undefined,
        payment_status: PaymentStatus.PAGO,
        due_date: newTransaction.date,
        paid_date: paidDate,
        reference_month: referenceMonth,
        description: newTransaction.history,
        notes,
      });
      await refresh();
      setNewTransaction(buildDefaultTransaction());
      toast.success('Lançamento registrado com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível registrar o lançamento.');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteTransaction(id);
      toast.success('Lançamento removido.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível remover o lançamento.');
    }
  };

  const handleAddBank = () => {
    if (!newBank.name || !newBank.accountNumber) return;

    const bank: Bank = {
      id: String(banks.length + 1),
      name: newBank.name,
      accountNumber: newBank.accountNumber,
      balance: newBank.balance ? Number.parseFloat(newBank.balance) : 0,
      accountingAccount: newBank.accountingAccount || undefined,
    };

    setBanks((prev) => [...prev, bank]);
    setIsBankModalOpen(false);
    setNewBank({ name: '', accountNumber: '', balance: '', accountingAccount: '' });
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
            className="w-[180px]"
            aria-label="Mês de referência"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Início</label>
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
          <Button variant="bordered" onPress={setCurrentMonthRange}>Mês atual</Button>
          <Button variant="bordered" onPress={setPreviousMonthRange}>Mês anterior</Button>
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

      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Saldo de Bancos e Caixa
          </h3>
          <Button
            variant="bordered"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onPress={() => setIsBankModalOpen(true)}
          >
            Novo Banco
          </Button>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {banks.map((bank) => (
              <Card key={bank.id} className="bg-slate-50 dark:bg-slate-900/20">
                <CardBody className="space-y-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400">{bank.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    Conta: {bank.accountNumber}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(bank.balance)}
                  </p>
                  {bank.accountingAccount && (
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      Conta contábil: {bank.accountingAccount}
                    </p>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Novo lançamento
          </h3>
          <Button
            variant="bordered"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onPress={() => setIsHistoryModalOpen(true)}
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
                const value = Array.from(keys)[0] as TransactionType | undefined;
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
              selectedKeys={[newTransaction.bank]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string | undefined;
                if (value) {
                  setNewTransaction((prev) => ({ ...prev, bank: value }));
                }
              }}
            >
              {banks.map((bank) => (
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
          <Table aria-label="Tabela de lançamentos do escritório" removeWrapper>
            <TableHeader>
              <TableColumn>Data</TableColumn>
              <TableColumn>Tipo</TableColumn>
              <TableColumn>Banco</TableColumn>
              <TableColumn>Histórico</TableColumn>
              <TableColumn>Observação</TableColumn>
              <TableColumn className="text-right">Valor</TableColumn>
              <TableColumn className="text-right">Ações</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Nenhum lançamento cadastrado">
              {displayTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{new Date(transaction.date).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>{transaction.type}</TableCell>
                  <TableCell>
                    {transaction.bank || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {transaction.history}
                      {transaction.isRecurring && (
                        <Repeat className="h-4 w-4 text-primary-600" title="Lançamento recorrente" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                    {transaction.observation ?? '-'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(transaction.value)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="light"
                      isIconOnly
                      aria-label="Excluir lançamento"
                      onPress={() => handleDeleteTransaction(transaction.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Modal isOpen={isBankModalOpen} onClose={() => setIsBankModalOpen(false)}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Adicionar Banco</ModalHeader>
              <ModalBody className="space-y-3">
                <Input
                  label="Nome do Banco *"
                  placeholder="Ex: Banco do Brasil"
                  value={newBank.name}
                  onValueChange={(value) => setNewBank((prev) => ({ ...prev, name: value }))}
                />
                <Input
                  label="Número da Conta *"
                  placeholder="Ex: 12345-6"
                  value={newBank.accountNumber}
                  onValueChange={(value) =>
                    setNewBank((prev) => ({ ...prev, accountNumber: value }))
                  }
                />
                <Input
                  label="Saldo Inicial"
                  type="number"
                  placeholder="0,00"
                  value={newBank.balance}
                  onValueChange={(value) => setNewBank((prev) => ({ ...prev, balance: value }))}
                />
                <Input
                  label="Conta Contábil"
                  placeholder="Ex: 1.1.1.01"
                  value={newBank.accountingAccount}
                  onValueChange={(value) =>
                    setNewBank((prev) => ({ ...prev, accountingAccount: value }))
                  }
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="primary" onPress={handleAddBank}>
                  Adicionar
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
    </div>
  );
}
