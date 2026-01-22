"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Card,
  CardBody,
  CardHeader,
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
  useDisclosure,
} from "@/heroui";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { clientsApi } from "@/lib/api/endpoints/clients";
import { useTransactions } from "@/hooks/useTransactions";
import type { Client, ClientListItem } from "@/types/client";
import {
  PaymentMethod,
  PaymentStatus,
  TransactionType,
  type Transaction,
  type TransactionUpdate,
  getPaymentMethodLabel,
} from "@/types/finance";
import { toast } from "@/lib/toast";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { endOfMonth, formatISO, startOfMonth, subMonths } from "date-fns";
import { useAuth } from "@/hooks/auth/AuthContext";
import { NovoLancamentoModal, type NovoLancamentoData } from "./NovoLancamentoModal";
import { bankAccountsApi } from "@/lib/api/endpoints/bank-accounts";
import type { BankAccount } from "@/types/bank-account";

interface ClientTransaction {
  id: string;
  date: string;
  type: TransactionType;
  history: string;
  value: number;
  payment: string;
  raw: Transaction;
}

export function FinanceiroPorEmpresa({
  onExportLivro,
  onClientChange,
}: {
  onExportLivro?: (client?: ClientListItem | null) => void;
  onClientChange?: (client: ClientListItem | null) => void;
}) {
  const { user } = useAuth();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const isAdminOrFunc = user?.role !== "cliente";
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [clientDetails, setClientDetails] = useState<Client | null>(null);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [monthFilter, setMonthFilter] = useState(formatISO(new Date(), { representation: "date" }).slice(0, 7));
  const [startDate, setStartDate] = useState(formatISO(startOfMonth(new Date()), { representation: "date" }));
  const [endDate, setEndDate] = useState(formatISO(endOfMonth(new Date()), { representation: "date" }));
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [bankForm, setBankForm] = useState({
    name: "",
    account_number: "",
    balance: "",
    accounting_account: "",
  });
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    due_date: "",
    payment_status: PaymentStatus.PENDENTE,
    payment_method: "" as PaymentMethod | "",
    paid_date: "",
    category: "",
    notes: "",
    invoice_number: "",
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        setIsLoadingClients(true);
        if (!isAdminOrFunc) {
          const client = await clientsApi.getMe();
          if (active) {
            setClients([client]);
            console.log("Clientes carregados:", 1);
          }
          return;
        }

        const response = await clientsApi.list({ size: 0 });
        if (active) {
          setClients(response.items);
          console.log("Clientes carregados:", response.items.length);
        }
      } catch (error) {
        console.error("Erro ao buscar clientes", error);
        toast.error("Não foi possível carregar os clientes.");
      } finally {
        if (active) setIsLoadingClients(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, isAdminOrFunc]);

  useEffect(() => {
    if (!selectedClient && clients.length > 0 && clients[0]) {
      // Auto-select first client
      setSelectedClient(clients[0].id);
      setClientSearch(`${clients[0].nome_fantasia || clients[0].razao_social} — ${clients[0].cnpj}`);
    }
  }, [clients]); // Remove selectedClient from dependencies to avoid loop

  const setRangeForMonth = (monthValue: string) => {
    if (!monthValue) return;
    const [year, month] = monthValue.split("-");
    if (!year || !month) return;
    const parsedYear = Number.parseInt(year, 10);
    const parsedMonth = Number.parseInt(month, 10);
    if (!parsedYear || !parsedMonth) return;
    const monthLabel = String(parsedMonth).padStart(2, "0");
    const lastDay = new Date(parsedYear, parsedMonth, 0).getDate();
    setStartDate(`${parsedYear}-${monthLabel}-01`);
    setEndDate(`${parsedYear}-${monthLabel}-${String(lastDay).padStart(2, "0")}`);
  };

  const handleMonthChange = (value: string) => {
    setMonthFilter(value);
    if (value) {
      setRangeForMonth(value);
    }
  };

  const setCurrentMonthRange = () => {
    const currentMonth = formatISO(new Date(), { representation: "date" }).slice(0, 7);
    setMonthFilter(currentMonth);
    setRangeForMonth(currentMonth);
  };

  const setPreviousMonthRange = () => {
    const previous = subMonths(new Date(), 1);
    const previousMonth = formatISO(previous, { representation: "date" }).slice(0, 7);
    setMonthFilter(previousMonth);
    setRangeForMonth(previousMonth);
  };

  const normalizeMonthFilter = (startValue: string, endValue: string) => {
    const [startYear, startMonth, startDay] = startValue.split("-");
    const [endYear, endMonth, endDay] = endValue.split("-");
    if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
      return "";
    }
    if (startYear !== endYear || startMonth !== endMonth) {
      return "";
    }
    if (startDay !== "01") {
      return "";
    }
    const lastDay = new Date(Number(startYear), Number(startMonth), 0).getDate();
    const expectedEndDay = String(lastDay).padStart(2, "0");
    if (endDay !== expectedEndDay) {
      return "";
    }
    return `${startYear}-${startMonth}`;
  };

  useEffect(() => {
    const normalized = normalizeMonthFilter(startDate, endDate);
    if (normalized && normalized !== monthFilter) {
      setMonthFilter(normalized);
    }
    if (!normalized && monthFilter) {
      setMonthFilter("");
    }
  }, [startDate, endDate, monthFilter]);

  useEffect(() => {
    if (!selectedClient) {
      setClientDetails(null);
      return;
    }

    let active = true;
    (async () => {
      try {
        const client = await clientsApi.getById(selectedClient);
        if (active) setClientDetails(client);
      } catch (error) {
        console.error("Erro ao buscar detalhes do cliente", error);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedClient]);

  const resetBankForm = useCallback(() => {
    setBankForm({
      name: "",
      account_number: "",
      balance: "",
      accounting_account: "",
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
          balance: bank.balance?.toString() ?? "",
          accounting_account: bank.accounting_account ?? "",
        });
      } else {
        resetBankForm();
      }
      setIsBankModalOpen(true);
    },
    [resetBankForm]
  );

  const loadBankAccounts = useCallback(
    async (clientId?: string) => {
      if (isAdminOrFunc && !clientId) {
        setBankAccounts([]);
        return;
      }
      setIsLoadingBanks(true);
      try {
        const response = await bankAccountsApi.list({
          client_id: isAdminOrFunc ? clientId : undefined,
          limit: 200,
        });
        const normalized = response.items.map((bank) => ({
          ...bank,
          balance: Number(bank.balance) || 0,
        }));
        setBankAccounts(normalized);
      } catch (error) {
        console.error("Erro ao carregar bancos", error);
        toast.error("Não foi possível carregar os bancos.");
      } finally {
        setIsLoadingBanks(false);
      }
    },
    [isAdminOrFunc]
  );

  useEffect(() => {
    if (!user) return;
    void loadBankAccounts(isAdminOrFunc ? selectedClient || undefined : undefined);
  }, [loadBankAccounts, isAdminOrFunc, selectedClient, user]);

  const handleSaveBank = async () => {
    if (!bankForm.name.trim() || !bankForm.account_number.trim()) {
      toast.error("Informe o nome e o número da conta.");
      return;
    }
    if (isAdminOrFunc && !selectedClient) {
      toast.error("Selecione uma empresa antes de cadastrar bancos.");
      return;
    }

    const balanceValue = bankForm.balance ? Number.parseFloat(bankForm.balance) : 0;
    if (Number.isNaN(balanceValue)) {
      toast.error("Informe um saldo válido.");
      return;
    }

    try {
      if (editingBank) {
        await bankAccountsApi.update(editingBank.id, {
          name: bankForm.name.trim(),
          account_number: bankForm.account_number.trim(),
          balance: balanceValue,
          accounting_account: bankForm.accounting_account.trim() || null,
        });
        toast.success("Banco atualizado com sucesso.");
      } else {
        await bankAccountsApi.create({
          client_id: isAdminOrFunc ? selectedClient : undefined,
          name: bankForm.name.trim(),
          account_number: bankForm.account_number.trim(),
          balance: balanceValue,
          accounting_account: bankForm.accounting_account.trim() || null,
        });
        toast.success("Banco cadastrado com sucesso.");
      }
      setIsBankModalOpen(false);
      resetBankForm();
      await loadBankAccounts(isAdminOrFunc ? selectedClient || undefined : undefined);
    } catch (error) {
      console.error("Erro ao salvar banco", error);
      toast.error("Não foi possível salvar o banco.");
    }
  };

  const handleDeleteBank = async (bankId: string) => {
    const confirmed = window.confirm("Tem certeza que deseja excluir este banco?");
    if (!confirmed) return;
    try {
      await bankAccountsApi.delete(bankId);
      toast.success("Banco removido com sucesso.");
      await loadBankAccounts(isAdminOrFunc ? selectedClient || undefined : undefined);
    } catch (error) {
      console.error("Erro ao excluir banco", error);
      toast.error("Não foi possível excluir o banco.");
    }
  };

  const transactionFilters = useMemo(
    () => ({
      client_id: selectedClient || undefined,
      due_date_from: startDate,
      due_date_to: endDate,
      page: 1,
      size: 100,
    }),
    [selectedClient, startDate, endDate]
  );

  const { transactions, refresh, createTransaction, updateTransaction } = useTransactions({
    filters: transactionFilters,
    autoFetch: Boolean(selectedClient),
  });

  const handleSaveTransaction = async (data: NovoLancamentoData) => {
    if (!selectedClient) {
      toast.error("Selecione uma empresa antes de lançar.");
      return;
    }

    try {
      await createTransaction({ ...data, client_id: selectedClient });
      toast.success("Lançamento salvo com sucesso.");
      await refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("finance:transactions-updated"));
      }
    } catch (error) {
      console.error("Erro ao salvar lançamento:", error);
      const errorDetail = (error as { data?: { detail?: string } })?.data?.detail;
      const message = typeof errorDetail === "string" ? errorDetail : "Não foi possível salvar o lançamento.";
      toast.error(message);
      throw error;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleRefresh = () => {
      if (!selectedClient) return;
      refresh().catch((error) => {
        console.error("Erro ao atualizar lançamentos", error);
      });
    };
    window.addEventListener("finance:transactions-updated", handleRefresh);
    return () => {
      window.removeEventListener("finance:transactions-updated", handleRefresh);
    };
  }, [refresh, selectedClient]);

  const displayTransactions = useMemo<ClientTransaction[]>(
    () =>
      transactions.map((transaction) => ({
        id: transaction.id,
        date: transaction.paid_date || transaction.due_date,
        type: transaction.transaction_type,
        history: transaction.description,
        value: transaction.amount,
        payment: transaction.payment_method
          ? getPaymentMethodLabel(transaction.payment_method) || transaction.payment_method
          : "-",
        raw: transaction,
      })),
    [transactions]
  );

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return clients;

    return clients.filter((client) => {
      const fantasia = (client.nome_fantasia || "").toLowerCase();
      const razao = client.razao_social.toLowerCase();
      const cnpj = client.cnpj.toLowerCase();
      const label = `${client.nome_fantasia || client.razao_social} — ${client.cnpj}`.toLowerCase();
      return label.includes(query) || fantasia.includes(query) || razao.includes(query) || cnpj.includes(query);
    });
  }, [clients, clientSearch]);

  const receita = useMemo(
    () =>
      displayTransactions
        .filter((t) => t.type === TransactionType.RECEITA)
        .reduce((sum, t) => sum + t.value, 0),
    [displayTransactions]
  );
  const despesa = useMemo(
    () =>
      displayTransactions
        .filter((t) => t.type === TransactionType.DESPESA)
        .reduce((sum, t) => sum + t.value, 0),
    [displayTransactions]
  );
  const lucro = receita - despesa;

  const aReceber = useMemo(
    () =>
      transactions
        .filter(
          (transaction) =>
            transaction.transaction_type === TransactionType.RECEITA &&
            transaction.payment_status !== PaymentStatus.PAGO
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [transactions]
  );
  const aPagar = useMemo(
    () =>
      transactions
        .filter(
          (transaction) =>
            transaction.transaction_type === TransactionType.DESPESA &&
            transaction.payment_status !== PaymentStatus.PAGO
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [transactions]
  );

  const selectedClientListItem = clients.find((client) => client.id === selectedClient) ?? null;
  const selectedClientData = clientDetails ?? selectedClientListItem;
  const selectedClientLabel = selectedClientData
    ? `${selectedClientData.nome_fantasia || selectedClientData.razao_social} — ${selectedClientData.cnpj}`
    : "";
  const selectedClientOption = selectedClientData
    ? [
        {
          id: selectedClientData.id,
          name: `${selectedClientData.nome_fantasia || selectedClientData.razao_social} — ${selectedClientData.cnpj}`,
        },
      ]
    : [];

  useEffect(() => {
    if (!onClientChange) return;
    onClientChange(selectedClientListItem);
  }, [onClientChange, selectedClientListItem]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const normalizeDateInput = (value?: string | null): string => {
    if (!value) return "";
    const parts = value.split("T");
    return parts[0] ?? "";
  };

  const openEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setEditForm({
      description: transaction.description ?? "",
      amount: transaction.amount?.toString() ?? "",
      due_date: normalizeDateInput(transaction.due_date),
      payment_status: transaction.payment_status ?? PaymentStatus.PENDENTE,
      payment_method: transaction.payment_method ?? "",
      paid_date: normalizeDateInput(transaction.paid_date),
      category: transaction.category ?? "",
      notes: transaction.notes ?? "",
      invoice_number: transaction.invoice_number ?? "",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;
    const amountValue = Number.parseFloat(editForm.amount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error("Informe um valor valido.");
      return;
    }
    if (!editForm.description.trim()) {
      toast.error("Informe a descricao.");
      return;
    }
    if (!editForm.due_date) {
      toast.error("Informe a data de vencimento.");
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
          ? editForm.paid_date || null
          : null,
      category: editForm.category.trim() || null,
      notes: editForm.notes.trim() || null,
      invoice_number: editForm.invoice_number.trim() || null,
    };

    try {
      await updateTransaction(editingTransaction.id, payload);
      toast.success("Lancamento atualizado com sucesso.");
      setIsEditModalOpen(false);
      setEditingTransaction(null);
      await refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("finance:transactions-updated"));
      }
    } catch (error) {
      console.error("Erro ao atualizar lancamento:", error);
      toast.error("Nao foi possivel atualizar o lancamento.");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Selecione a empresa</label>
              <Autocomplete
                selectedKey={selectedClient || ""}
                onSelectionChange={(key) => {
                  if (!key) {
                    setSelectedClient("");
                    setClientSearch("");
                    return;
                  }
                  const value = String(key);
                  const selected = clients.find((client) => client.id === value);
                  setSelectedClient(value);
                  if (selected) {
                    setClientSearch(`${selected.nome_fantasia || selected.razao_social} — ${selected.cnpj}`);
                  }
                }}
                placeholder={isLoadingClients ? "Carregando empresas..." : "Digite para buscar empresa..."}
                aria-label="Buscar empresa"
                className="max-w-[420px]"
                isDisabled={isLoadingClients || clients.length === 0}
                isLoading={isLoadingClients}
                inputValue={clientSearch}
                onInputChange={setClientSearch}
                defaultInputValue={selectedClientLabel}
                isClearable
                allowsCustomValue={false}
                listboxProps={{
                  emptyContent: isLoadingClients ? "Carregando empresas..." : "Nenhuma empresa encontrada",
                }}
              >
                {filteredClients.map((client) => (
                  <AutocompleteItem
                    key={client.id}
                    textValue={`${client.nome_fantasia || client.razao_social} — ${client.cnpj}`}
                  >
                    {(client.nome_fantasia || client.razao_social) ?? "-"} — {client.cnpj}
                  </AutocompleteItem>
                ))}
              </Autocomplete>
            </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              color="primary"
              variant="solid"
              startContent={<Plus className="h-4 w-4" />}
              onPress={onOpen}
              isDisabled={!selectedClient || isLoadingClients}
            >
              Novo Lançamento
            </Button>
            <Button
              color="primary"
              variant="flat"
              startContent={<Download className="h-4 w-4" />}
              onPress={() => onExportLivro?.(selectedClientListItem)}
              isDisabled={!onExportLivro}
            >
              Exportar Livro Caixa
            </Button>
          </div>
          </div>
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
              <Button variant="bordered" onPress={setCurrentMonthRange}>
                Mês atual
              </Button>
              <Button variant="bordered" onPress={setPreviousMonthRange}>
                Mês anterior
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900">
          <CardBody>
            <p className="text-sm text-green-700 dark:text-green-400 font-medium mb-1">RECEITA</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(receita)}</p>
          </CardBody>
        </Card>
        <Card className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900">
          <CardBody>
            <p className="text-sm text-amber-700 dark:text-amber-400 font-medium mb-1">DESPESA</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(despesa)}</p>
          </CardBody>
        </Card>
        <Card className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-900">
          <CardBody>
            <p className="text-sm text-teal-700 dark:text-teal-400 font-medium mb-1">LUCRO</p>
            <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">{formatCurrency(lucro)}</p>
          </CardBody>
        </Card>
        <Card className="bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800">
          <CardBody>
            <p className="text-sm text-slate-700 dark:text-slate-400 font-medium mb-1">A RECEBER</p>
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-400">{formatCurrency(aReceber)}</p>
          </CardBody>
        </Card>
        <Card className="bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800">
          <CardBody>
            <p className="text-sm text-slate-700 dark:text-slate-400 font-medium mb-1">A PAGAR</p>
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-400">{formatCurrency(aPagar)}</p>
          </CardBody>
        </Card>
      </div>

      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Saldo por Banco
            </h3>
            <p className="text-sm text-default-500">
              Acompanhe e gerencie os saldos das contas bancárias
            </p>
          </div>
          <Button
            color="primary"
            variant="flat"
            startContent={<Plus className="h-4 w-4" />}
            onPress={() => openBankModal()}
            isDisabled={isAdminOrFunc && !selectedClient}
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
        <CardBody>
          <h3 className="text-lg font-semibold mb-4">Informações da Empresa</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">CNPJ</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{selectedClientData?.cnpj ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Honorários Mensais</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {formatCurrency(selectedClientData?.honorarios_mensais ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Email</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{selectedClientData?.email ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Telefone</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{clientDetails?.telefone ?? "-"}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardBody className="space-y-4">
          <h3 className="text-lg font-semibold">Lançamentos</h3>
          <Table aria-label="Lançamentos financeiros por empresa" removeWrapper>
            <TableHeader>
              <TableColumn>Data</TableColumn>
              <TableColumn>Tipo</TableColumn>
              <TableColumn>Histórico</TableColumn>
              <TableColumn className="text-right">Valor</TableColumn>
              <TableColumn>Recebimento</TableColumn>
              <TableColumn className={isAdminOrFunc ? "text-right" : "hidden"}>Ações</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Nenhum lançamento encontrado">
              {displayTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{new Date(transaction.date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{transaction.type === TransactionType.RECEITA ? "Entrada" : "Saída"}</TableCell>
                  <TableCell>{transaction.history}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(transaction.value)}</TableCell>
                  <TableCell>{transaction.payment}</TableCell>
                  <TableCell className={isAdminOrFunc ? "text-right" : "hidden"}>
                    {isAdminOrFunc && (
                      <Button
                        size="sm"
                        variant="light"
                        isIconOnly
                        aria-label="Editar lançamento"
                        onPress={() => openEditTransaction(transaction.raw)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              <ModalHeader>
                {editingBank ? "Editar Banco" : "Adicionar Banco"}
              </ModalHeader>
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
                <Button variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="primary" onPress={handleSaveBank}>
                  Salvar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <NovoLancamentoModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        onSave={handleSaveTransaction}
        clients={selectedClientOption}
        isLoadingClients={isLoadingClients}
        defaultClientId={selectedClient || null}
        isClientLocked={Boolean(selectedClient)}
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
                  placeholder="Ex: Honorarios do mes"
                  value={editForm.description}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, description: value }))}
                />
                <Input
                  label="Valor (R$)"
                  type="number"
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
                  label="Metodo de Pagamento"
                  selectedKeys={editForm.payment_method ? [editForm.payment_method] : []}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as PaymentMethod | undefined;
                    setEditForm((prev) => ({ ...prev, payment_method: value ?? "" }));
                  }}
                >
                  <SelectItem key={PaymentMethod.PIX}>PIX</SelectItem>
                  <SelectItem key={PaymentMethod.BOLETO}>Boleto</SelectItem>
                  <SelectItem key={PaymentMethod.TRANSFERENCIA}>Transferencia</SelectItem>
                  <SelectItem key={PaymentMethod.DINHEIRO}>Dinheiro</SelectItem>
                  <SelectItem key={PaymentMethod.CARTAO_CREDITO}>Cartao de Credito</SelectItem>
                  <SelectItem key={PaymentMethod.CARTAO_DEBITO}>Cartao de Debito</SelectItem>
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
                  label="Numero da Nota"
                  placeholder="Ex: NF-001/2024"
                  value={editForm.invoice_number}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, invoice_number: value }))}
                />
                <Textarea
                  label="Observacoes"
                  placeholder="Informacoes adicionais..."
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
    </div>
  );
}
