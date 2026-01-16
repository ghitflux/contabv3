"use client";

import { useEffect, useMemo, useState } from "react";
import { useDisclosure } from "@heroui/react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Skeleton,
} from "@/heroui";
import { ArrowDownRight, ArrowUpRight, Download, MoreVertical, Plus, Search } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import {
  PaymentStatus,
  TransactionType,
  getPaymentStatusColor,
  getPaymentStatusLabel,
} from "@/types/finance";
import type { ClientListItem } from "@/types/client";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { endOfMonth, formatISO, startOfMonth, subMonths } from "date-fns";
import { getContaByCodigo, formatConta } from "@/constants/planoDeContas";
import { NovoLancamentoModal, type NovoLancamentoData } from "./NovoLancamentoModal";
import { clientsApi } from "@/lib/api/endpoints/clients";
import { toast } from "@/lib/toast";

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
}

export function FinanceiroLancamentos() {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [monthFilter, setMonthFilter] = useState(formatISO(new Date(), { representation: "date" }).slice(0, 7));
  const [startDate, setStartDate] = useState(formatISO(startOfMonth(new Date()), { representation: "date" }));
  const [endDate, setEndDate] = useState(formatISO(endOfMonth(new Date()), { representation: "date" }));
  const [clients, setClients] = useState<ClientListItem[]>([]);

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
          console.error("Erro ao carregar clientes:", innerError);
          toast.error("Não foi possível carregar os clientes.");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Fetch transactions from API
  const { transactions, isLoading, fetchTransactions, createTransaction } = useTransactions({
    filters: transactionFilters,
    autoFetch: true,
  });

  const handleSaveTransaction = async (data: NovoLancamentoData) => {
    try {
      await createTransaction(data);
      toast.success("Lançamento salvo com sucesso.");

      // Recarregar dados
      await fetchTransactions(transactionFilters);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("finance:transactions-updated"));
      }
    } catch (error) {
      console.error("Erro ao salvar lançamento:", error);
      toast.error("Não foi possível salvar o lançamento.");
      throw error;
    }
  };

  const lancamentos = useMemo<Lancamento[]>(() => {
    return transactions.map((transaction) => ({
      id: transaction.id,
      data: transaction.paid_date || transaction.due_date,
      descricao: transaction.description ?? "",
      competencia: transaction.reference_month ?? "",
      categoria: transaction.category ?? null,
      tipo: transaction.transaction_type,
      valor: transaction.amount,
      status: transaction.payment_status,
      cliente: transaction.client_name ?? transaction.client_cnpj ?? undefined,
      pagamento: transaction.payment_method ?? undefined,
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

  const lancamentosFiltrados = useMemo(() => {
    const query = busca.trim().toLowerCase();
    return lancamentos.filter((lancamento) => {
      const matchTipo = filtroTipo === "todos" || lancamento.tipo === filtroTipo;
      const matchStatus = filtroStatus === "todos" || lancamento.status === filtroStatus;
      const matchBusca =
        query === "" ||
        lancamento.descricao.toLowerCase().includes(query) ||
        lancamento.competencia.toLowerCase().includes(query) ||
        (lancamento.categoria ?? "").toLowerCase().includes(query) ||
        (lancamento.cliente ?? "").toLowerCase().includes(query);

      return matchTipo && matchStatus && matchBusca;
    });
  }, [lancamentos, busca, filtroStatus, filtroTipo]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const formatDate = (date?: string | null) => {
    if (!date) return "-";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("pt-BR");
  };

  const formatCompetencia = (value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(parsed);
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
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Lançamentos Financeiros</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="bordered" startContent={<Download className="h-4 w-4" />}>
            Exportar
          </Button>
          <Button size="sm" color="primary" startContent={<Plus className="h-4 w-4" />} onPress={onOpen}>
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
                setFiltroTipo(value ?? "todos");
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
                setFiltroStatus(value ?? "todos");
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
              <TableColumn className="w-[50px]">{" "}</TableColumn>
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
                    <TableCell className="text-sm">{lancamento.cliente ?? "-"}</TableCell>
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
                      <Chip color={getPaymentStatusColor(lancamento.status)} variant="flat" size="sm">
                        {getPaymentStatusLabel(lancamento.status)}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <span className={lancamento.tipo === TransactionType.RECEITA ? "text-green-600" : "text-red-600"}>
                        {formatCurrency(lancamento.valor)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="light" size="sm" isIconOnly aria-label="Mais ações">
                        <MoreVertical className="h-4 w-4" />
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
      </CardBody>
    </Card>
  );
}
