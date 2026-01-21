"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Select,
  SelectItem,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/heroui";
import { auditLogsApi } from "@/lib/api/endpoints/audit-logs";
import { clientsApi } from "@/lib/api/endpoints/clients";
import type { AuditLog } from "@/types/audit";
import type { ClientListItem } from "@/types/client";
import { formatDateTime } from "@/lib/masks";

const ACTION_LABELS: Record<string, string> = {
  "transaction.create": "Lançamento criado",
  "bank_account.create": "Banco criado",
  "bank_account.update": "Banco atualizado",
  "bank_account.delete": "Banco removido",
};

const ENTITY_LABELS: Record<string, string> = {
  financial_transaction: "Lançamentos",
  bank_account: "Bancos",
};

export function FinanceiroHistoricoClientes() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clientOptions, setClientOptions] = useState<ClientListItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedEntity, setSelectedEntity] = useState<string>("all");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await clientsApi.list({ size: 0 });
        if (active) setClientOptions(response.items);
      } catch (error) {
        console.error("Erro ao carregar clientes", error);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setIsLoading(true);
        const response = await auditLogsApi.list({
          client_id: selectedClientId !== "all" ? selectedClientId : undefined,
          entity: selectedEntity !== "all" ? selectedEntity : undefined,
          limit: 200,
        });
        if (!active) return;
        const clientOnly = response.items.filter(
          (item) => item.user_role === "cliente"
        );
        setLogs(clientOnly);
      } catch (error) {
        console.error("Erro ao carregar histórico", error);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedClientId, selectedEntity]);

  const clientMap = useMemo(() => {
    const map = new Map<string, ClientListItem>();
    clientOptions.forEach((client) => map.set(client.id, client));
    return map;
  }, [clientOptions]);

  const renderClientName = (log: AuditLog) => {
    const clientId = log.payload?.client_id as string | undefined;
    if (!clientId) return "-";
    const client = clientMap.get(clientId);
    return client ? client.nome_fantasia || client.razao_social : clientId;
  };

  const formatPayloadValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
  };

  const renderBankUpdateDetails = (log: AuditLog) => {
    const before = log.payload?.before as Record<string, unknown> | undefined;
    const after = log.payload?.after as Record<string, unknown> | undefined;
    if (!before || !after) return "";

    const fields: Array<[string, string]> = [
      ["name", "Banco"],
      ["account_number", "Conta"],
      ["balance", "Saldo"],
      ["accounting_account", "Conta contábil"],
    ];

    const changes = fields
      .filter(([field]) => before[field] !== after[field])
      .map(([field, label]) => `${label}: ${formatPayloadValue(before[field])} -> ${formatPayloadValue(after[field])}`);

    return changes.join(" | ");
  };

  const renderDetails = (log: AuditLog) => {
    const summary = log.payload?.summary ? String(log.payload.summary) : "";
    if (log.action === "bank_account.update") {
      const changes = renderBankUpdateDetails(log);
      if (changes) return changes;
    }
    if (summary) return summary;
    if (log.entity === "financial_transaction") {
      const amount = log.payload?.amount ? `R$ ${log.payload.amount}` : "";
      const desc = log.payload?.description ?? "";
      return [desc, amount].filter(Boolean).join(" - ") || "Lançamento";
    }
    if (log.entity === "bank_account") {
      const name = log.payload?.name ?? "";
      const account = log.payload?.account_number ?? "";
      const balance = log.payload?.balance ? `Saldo ${log.payload.balance}` : "";
      return [name, account, balance].filter(Boolean).join(" - ") || "Banco";
    }
    return log.action;
  };

  return (
    <Card className="border border-default-200/50 dark:border-default-100/20">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Histórico de Ações de Clientes
          </h3>
          <p className="text-sm text-default-500">
            Acompanhe alterações feitas pelos clientes no financeiro
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            label="Cliente"
            selectedKeys={[selectedClientId]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string | undefined;
              setSelectedClientId(value ?? "all");
            }}
            className="min-w-[220px]"
          >
            <SelectItem key="all">Todos</SelectItem>
            {clientOptions.map((client) => (
              <SelectItem key={client.id}>
                {client.nome_fantasia || client.razao_social}
              </SelectItem>
            ))}
          </Select>
          <Select
            label="Tipo"
            selectedKeys={[selectedEntity]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string | undefined;
              setSelectedEntity(value ?? "all");
            }}
            className="min-w-[180px]"
          >
            <SelectItem key="all">Todos</SelectItem>
            <SelectItem key="financial_transaction">Lançamentos</SelectItem>
            <SelectItem key="bank_account">Bancos</SelectItem>
          </Select>
        </div>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <Table aria-label="Histórico de ações" removeWrapper>
            <TableHeader>
              <TableColumn>Data</TableColumn>
              <TableColumn>Cliente</TableColumn>
              <TableColumn>Usuário</TableColumn>
              <TableColumn>Tipo</TableColumn>
              <TableColumn>Detalhes</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Nenhuma ação registrada">
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDateTime(log.created_at)}</TableCell>
                  <TableCell>{renderClientName(log)}</TableCell>
                  <TableCell>{log.user_name || log.user_email || "-"}</TableCell>
                  <TableCell>{ENTITY_LABELS[log.entity] || log.entity}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {ACTION_LABELS[log.action] || log.action}
                      </p>
                      <p className="text-xs text-default-500">{renderDetails(log)}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
