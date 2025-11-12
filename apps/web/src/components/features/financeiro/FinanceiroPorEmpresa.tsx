"use client";

import { useMemo, useState } from "react";
import {
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

type TransactionType = "Entrada" | "Saída";

interface Client {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  monthlyFee: number;
}

interface ClientTransaction {
  id: string;
  date: string;
  type: TransactionType;
  history: string;
  value: number;
  payment: string;
}

const clients: Client[] = [
  {
    id: "1",
    name: "ABC Comércio Ltda",
    cnpj: "12.345.678/0001-99",
    email: "financeiro@abccomercio.com.br",
    phone: "(11) 3456-7890",
    monthlyFee: 2500,
  },
  {
    id: "2",
    name: "XYZ Indústria S.A.",
    cnpj: "98.765.432/0001-44",
    email: "contato@xyzindustria.com.br",
    phone: "(21) 2233-4455",
    monthlyFee: 4100,
  },
  {
    id: "3",
    name: "DEF Serviços Ltda",
    cnpj: "55.123.456/0001-11",
    email: "financeiro@defservicos.com.br",
    phone: "(31) 9988-7766",
    monthlyFee: 3800,
  },
];

const transactionsByClient: Record<string, ClientTransaction[]> = {
  "1": [
    { id: "1", date: "2025-10-27", type: "Entrada", history: "Honorários mensais", value: 2500, payment: "PIX" },
    { id: "2", date: "2025-10-15", type: "Entrada", history: "Serviço extra", value: 800, payment: "Boleto" },
    { id: "3", date: "2025-10-05", type: "Saída", history: "Ressarcimento taxas", value: 150, payment: "TED" },
  ],
  "2": [
    { id: "4", date: "2025-10-22", type: "Entrada", history: "Honorários mensais", value: 4100, payment: "PIX" },
    { id: "5", date: "2025-10-18", type: "Entrada", history: "Consultoria fiscal", value: 2200, payment: "Boleto" },
  ],
  "3": [
    { id: "6", date: "2025-10-25", type: "Entrada", history: "Honorários mensais", value: 3800, payment: "PIX" },
    { id: "7", date: "2025-10-12", type: "Entrada", history: "Serviço extraordinário", value: 1200, payment: "Cartão" },
    { id: "8", date: "2025-10-07", type: "Saída", history: "Desconto comercial", value: 200, payment: "PIX" },
  ],
};

export function FinanceiroPorEmpresa() {
  const [selectedClient, setSelectedClient] = useState<string>(clients[0]?.id ?? "");

  const transactions = transactionsByClient[selectedClient] ?? [];

  const receita = useMemo(() => transactions.filter((t) => t.type === "Entrada").reduce((sum, t) => sum + t.value, 0), [
    transactions,
  ]);
  const despesa = useMemo(() => transactions.filter((t) => t.type === "Saída").reduce((sum, t) => sum + t.value, 0), [
    transactions,
  ]);
  const lucro = receita - despesa;

  const selectedClientData = clients.find((client) => client.id === selectedClient);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <div className="space-y-6">
      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardBody className="space-y-4">
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
                {client.name} — {client.cnpj}
              </SelectItem>
            ))}
          </Select>
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
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-400">{formatCurrency(0)}</p>
          </CardBody>
        </Card>
        <Card className="bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800">
          <CardBody>
            <p className="text-sm text-slate-700 dark:text-slate-400 font-medium mb-1">A PAGAR</p>
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-400">{formatCurrency(0)}</p>
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
                {formatCurrency(selectedClientData?.monthlyFee ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Email</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{selectedClientData?.email ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Telefone</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{selectedClientData?.phone ?? "-"}</p>
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
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{new Date(transaction.date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{transaction.type}</TableCell>
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

