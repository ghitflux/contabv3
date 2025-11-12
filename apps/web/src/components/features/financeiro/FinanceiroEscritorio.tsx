"use client";

import { useMemo, useState } from "react";
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
} from "@/heroui";
import { DollarSign, Download, Plus, Repeat, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { FinanceiroGraficos } from "./FinanceiroGraficos";
import { FinanceiroKPIs, type FinanceiroKpi } from "./FinanceiroKPIs";
import { DatePickerField } from "@/components/ui/DatePickerField";

type TransactionType = "Entrada" | "Saída";

type Transaction = {
  id: string;
  date: string;
  type: TransactionType;
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
  type: "income" | "expense";
};

type NewTransactionState = {
  date: string;
  type: TransactionType;
  bank: string;
  history: string;
  observation: string;
  value: string;
  isRecurring: boolean;
  recurringDay: number;
};

const initialBanks: Bank[] = [
  { id: "1", name: "Banco do Brasil", accountNumber: "1234-7", balance: 12500.5, accountingAccount: "1.1.1.01" },
  { id: "2", name: "Caixa Econômica", accountNumber: "5678-9", balance: 6800.25, accountingAccount: "1.1.1.02" },
  { id: "3", name: "Pagamento PIX", accountNumber: "0001-2", balance: 9800.0, accountingAccount: "1.1.1.03" },
];

const initialHistories: StandardHistory[] = [
  { id: "1", description: "Honorários do mês", accountingAccount: "3.1.1.01", type: "income" },
  { id: "2", description: "Serviço extra", accountingAccount: "3.1.1.02", type: "income" },
  { id: "3", description: "Aluguel", accountingAccount: "2.1.1.01", type: "expense" },
  { id: "4", description: "Internet", accountingAccount: "2.1.1.02", type: "expense" },
];

const initialTransactions: Transaction[] = [
  {
    id: "1",
    date: "2025-10-27",
    type: "Entrada",
    bank: "1",
    history: "Honorários do mês",
    value: 3500.0,
  },
  {
    id: "2",
    date: "2025-10-27",
    type: "Saída",
    bank: "1",
    history: "Aluguel",
    value: 1800.0,
    isRecurring: true,
    recurringDay: 27,
  },
  {
    id: "3",
    date: "2025-10-27",
    type: "Saída",
    bank: "2",
    history: "Internet",
    value: 120.0,
    isRecurring: true,
    recurringDay: 27,
  },
];

const defaultNewTransaction: NewTransactionState = {
  date: "2025-10-27",
  type: "Entrada",
  bank: "1",
  history: "",
  observation: "",
  value: "",
  isRecurring: false,
  recurringDay: 1,
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

export function FinanceiroEscritorio() {
  const [startDate, setStartDate] = useState("2025-10-01");
  const [endDate, setEndDate] = useState("2025-10-31");
  const [banks, setBanks] = useState<Bank[]>(initialBanks);
  const [standardHistories, setStandardHistories] = useState<StandardHistory[]>(initialHistories);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [newBank, setNewBank] = useState({
    name: "",
    accountNumber: "",
    balance: "",
    accountingAccount: "",
  });
  const [newHistory, setNewHistory] = useState({
    description: "",
    accountingAccount: "",
    type: "income" as "income" | "expense",
  });
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [newTransaction, setNewTransaction] = useState<NewTransactionState>(defaultNewTransaction);

  const receita = useMemo(
    () => transactions.filter((t) => t.type === "Entrada").reduce((sum, t) => sum + t.value, 0),
    [transactions],
  );
  const despesa = useMemo(
    () => transactions.filter((t) => t.type === "Saída").reduce((sum, t) => sum + t.value, 0),
    [transactions],
  );
  const lucro = receita - despesa;

  const kpis: FinanceiroKpi[] = [
    {
      title: "Receita do Período",
      value: formatCurrency(receita),
      change: "+4,2% vs mês anterior",
      trend: "up",
      icon: DollarSign,
      colorClass: "text-green-600",
      backgroundClass: "bg-green-50 dark:bg-green-900/20",
    },
    {
      title: "Despesas",
      value: formatCurrency(despesa),
      change: "+1,8% vs mês anterior",
      trend: "up",
      icon: TrendingDown,
      colorClass: "text-amber-600",
      backgroundClass: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      title: "Lucro",
      value: formatCurrency(lucro),
      change: "+6,5% vs mês anterior",
      trend: "up",
      icon: TrendingUp,
      colorClass: "text-teal-600",
      backgroundClass: "bg-teal-50 dark:bg-teal-900/20",
    },
  ];

  const handleAddTransaction = () => {
    if (!newTransaction.history || !newTransaction.value) {
      return;
    }

    const transaction: Transaction = {
      id: String(transactions.length + 1),
      date: newTransaction.date,
      type: newTransaction.type,
      bank: newTransaction.bank,
      history: newTransaction.history,
      observation: newTransaction.observation || undefined,
      value: Number.parseFloat(newTransaction.value),
      isRecurring: newTransaction.isRecurring,
      recurringDay: newTransaction.isRecurring ? newTransaction.recurringDay : undefined,
    };

    setTransactions((prev) => [...prev, transaction]);
    setNewTransaction(defaultNewTransaction);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
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
    setNewBank({ name: "", accountNumber: "", balance: "", accountingAccount: "" });
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
    setNewHistory({ description: "", accountingAccount: "", type: "income" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Início</label>
          <DatePickerField value={startDate} onChange={setStartDate} size="sm" className="w-[180px]" aria-label="Data inicial" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Fim</label>
          <DatePickerField value={endDate} onChange={setEndDate} size="sm" className="w-[180px]" aria-label="Data final" />
        </div>
        <div className="md:ml-auto flex gap-2">
          <Button variant="bordered">Mês atual</Button>
          <Button variant="bordered">Mês anterior</Button>
          <Button color="primary" startContent={<Download className="h-4 w-4" />}>
            Exportar Livro
          </Button>
        </div>
      </div>

      <FinanceiroKPIs kpis={kpis} />
      <FinanceiroGraficos />

      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Saldo de Bancos e Caixa</h3>
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
                  <p className="text-xs text-slate-500 dark:text-slate-500">Conta: {bank.accountNumber}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(bank.balance)}</p>
                  {bank.accountingAccount && (
                    <p className="text-xs text-slate-500 dark:text-slate-500">Conta contábil: {bank.accountingAccount}</p>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Novo lançamento</h3>
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
                  setNewTransaction((prev) => ({ ...prev, type: value, history: "" }));
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
                setNewTransaction((prev) => ({ ...prev, history: value ?? "" }));
              }}
              placeholder="Selecione..."
            >
              {standardHistories
                .filter((history) => (newTransaction.type === "Entrada" ? history.type === "income" : history.type === "expense"))
                .map((history) => (
                  <SelectItem key={history.description}>
                    {history.description}
                    {history.accountingAccount ? ` (${history.accountingAccount})` : ""}
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
                  setNewTransaction((prev) => ({ ...prev, isRecurring: checked, recurringDay: checked ? prev.recurringDay : 1 }))
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
            onValueChange={(value) => setNewTransaction((prev) => ({ ...prev, observation: value }))}
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
                  recurringDay: Number.parseInt(value || "1", 10),
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
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{new Date(transaction.date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{transaction.type}</TableCell>
                  <TableCell>{banks.find((bank) => bank.id === transaction.bank)?.name ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {transaction.history}
                      {transaction.isRecurring && (
                        <Repeat className="h-4 w-4 text-blue-600" title="Lançamento recorrente" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                    {transaction.observation ?? "-"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(transaction.value)}</TableCell>
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
                  onValueChange={(value) => setNewBank((prev) => ({ ...prev, accountNumber: value }))}
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
                  onValueChange={(value) => setNewBank((prev) => ({ ...prev, accountingAccount: value }))}
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
                  onValueChange={(value) => setNewHistory((prev) => ({ ...prev, description: value }))}
                />
                <Select
                  label="Tipo *"
                  selectedKeys={[newHistory.type]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as "income" | "expense" | undefined;
                    setNewHistory((prev) => ({ ...prev, type: value ?? "income" }));
                  }}
                >
                  <SelectItem key="income">Receita</SelectItem>
                  <SelectItem key="expense">Despesa</SelectItem>
                </Select>
                <Input
                  label="Conta Contábil"
                  placeholder="Ex: 3.1.1.01"
                  value={newHistory.accountingAccount}
                  onValueChange={(value) => setNewHistory((prev) => ({ ...prev, accountingAccount: value }))}
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

