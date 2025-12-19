"use client";

import { useMemo, useState } from "react";
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

type LancamentoTipo = "receita" | "despesa";
type LancamentoStatus = "pago" | "pendente" | "atrasado";

interface Lancamento {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  tipo: LancamentoTipo;
  valor: number;
  status: LancamentoStatus;
  cliente?: string;
}

export function FinanceiroLancamentos() {
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  // Fetch transactions from API
  const { transactions, isLoading } = useTransactions({ autoFetch: true });

  const lancamentosFiltrados = useMemo(() => {
    return transactions.filter((lancamento) => {
      const matchTipo = filtroTipo === "todos" || lancamento.tipo === filtroTipo;
      const matchStatus = filtroStatus === "todos" || lancamento.status === filtroStatus;
      const matchBusca =
        busca.trim() === "" ||
        lancamento.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        lancamento.categoria.toLowerCase().includes(busca.toLowerCase()) ||
        lancamento.cliente?.toLowerCase().includes(busca.toLowerCase());

      return matchTipo && matchStatus && matchBusca;
    });
  }, [transactions, busca, filtroStatus, filtroTipo]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR");

  const getStatusColor = (status: LancamentoStatus) => {
    if (status === "pago") return "success";
    if (status === "pendente") return "warning";
    return "danger";
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
          <Button size="sm" color="primary" startContent={<Plus className="h-4 w-4" />}>
            Novo Lançamento
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
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
            <SelectItem key="receita">Receitas</SelectItem>
            <SelectItem key="despesa">Despesas</SelectItem>
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
            <SelectItem key="pago">Pago</SelectItem>
            <SelectItem key="pendente">Pendente</SelectItem>
            <SelectItem key="atrasado">Atrasado</SelectItem>
          </Select>
        </div>

        <div className="rounded-lg border border-default-200/60 dark:border-default-100/20">
          <Table aria-label="Tabela de lançamentos financeiros" removeWrapper>
            <TableHeader>
              <TableColumn>Data</TableColumn>
              <TableColumn>Descrição</TableColumn>
              <TableColumn>Categoria</TableColumn>
              <TableColumn>Cliente</TableColumn>
              <TableColumn>Tipo</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn className="text-right">Valor</TableColumn>
              <TableColumn className="w-[50px]"></TableColumn>
            </TableHeader>
            <TableBody emptyContent="Nenhum lançamento encontrado">
              {lancamentosFiltrados.map((lancamento) => (
                <TableRow key={lancamento.id}>
                  <TableCell className="font-medium">{formatDate(lancamento.data)}</TableCell>
                  <TableCell>{lancamento.descricao}</TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-400">{lancamento.categoria}</TableCell>
                  <TableCell className="text-sm">{lancamento.cliente ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {lancamento.tipo === "receita" ? (
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
                    <Chip color={getStatusColor(lancamento.status)} variant="flat" size="sm">
                      {lancamento.status === "pago"
                        ? "Pago"
                        : lancamento.status === "pendente"
                          ? "Pendente"
                          : "Atrasado"}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <span className={lancamento.tipo === "receita" ? "text-green-600" : "text-red-600"}>
                      {formatCurrency(lancamento.valor)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="light" size="sm" isIconOnly aria-label="Mais ações">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardBody>
    </Card>
  );
}

