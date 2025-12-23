"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/heroui";
import { Download } from "lucide-react";
import { clientsApi } from "@/lib/api/endpoints/clients";
import { useTransactions } from "@/hooks/useTransactions";
import type { Client, ClientListItem } from "@/types/client";
import { PaymentStatus, TransactionType, getPaymentMethodLabel } from "@/types/finance";
import { toast } from "@/lib/toast";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { endOfMonth, formatISO, startOfMonth, subMonths } from "date-fns";

interface ClientTransaction {
  id: string;
  date: string;
  type: TransactionType;
  history: string;
  value: number;
  payment: string;
}

export function FinanceiroPorEmpresa({ onExportLivro }: { onExportLivro?: () => void }) {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [clientDetails, setClientDetails] = useState<Client | null>(null);
  const [monthFilter, setMonthFilter] = useState(formatISO(new Date(), { representation: "date" }).slice(0, 7));
  const [startDate, setStartDate] = useState(formatISO(startOfMonth(new Date()), { representation: "date" }));
  const [endDate, setEndDate] = useState(formatISO(endOfMonth(new Date()), { representation: "date" }));

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await clientsApi.list({ size: 100 });
        if (active) setClients(response.items);
      } catch (error) {
        console.error("Erro ao buscar clientes", error);
        toast.error("Não foi possível carregar os clientes.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedClient && clients.length > 0) {
      setSelectedClient(clients[0].id);
    }
  }, [clients, selectedClient]);

  const setRangeForMonth = (monthValue: string) => {
    if (!monthValue) return;
    const [year, month] = monthValue.split("-");
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

  const { transactions } = useTransactions({
    filters: {
      client_id: selectedClient || undefined,
      due_date_from: startDate,
      due_date_to: endDate,
      page: 1,
      size: 200,
    },
    autoFetch: Boolean(selectedClient),
  });

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
      })),
    [transactions]
  );

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

  const selectedClientData = clientDetails ?? clients.find((client) => client.id === selectedClient);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <div className="space-y-6">
      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Selecione a empresa</label>
              <Select
                selectedKeys={selectedClient ? [selectedClient] : []}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string | undefined;
                  if (value) {
                    setSelectedClient(value);
                  }
                }}
                aria-label="Selecionar empresa"
                className="max-w-[420px]"
              >
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {(client.nome_fantasia || client.razao_social) ?? "-"} — {client.cnpj}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <Button
              color="primary"
              variant="flat"
              startContent={<Download className="h-4 w-4" />}
              onPress={onExportLivro}
              isDisabled={!onExportLivro}
            >
              Exportar Livro Caixa
            </Button>
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
            </TableHeader>
            <TableBody emptyContent="Nenhum lançamento encontrado">
              {displayTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{new Date(transaction.date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{transaction.type === TransactionType.RECEITA ? "Entrada" : "Saída"}</TableCell>
                  <TableCell>{transaction.history}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(transaction.value)}</TableCell>
                  <TableCell>{transaction.payment}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
