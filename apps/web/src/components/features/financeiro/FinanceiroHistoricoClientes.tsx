"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
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
import { Search } from "lucide-react";
import { auditLogsApi } from "@/lib/api/endpoints/audit-logs";
import { clientsApi } from "@/lib/api/endpoints/clients";
import type { AuditLog } from "@/types/audit";
import type { ClientListItem } from "@/types/client";
import { formatDateTime } from "@/lib/masks";
import { useAuth } from "@/hooks/auth/AuthContext";

const ACTION_LABELS: Record<string, string> = {
  "transaction.create": "Lançamento criado",
  "transaction.update": "Lançamento atualizado",
  "transaction.mark_paid": "Baixa de lançamento",
  "transaction.delete": "Lançamento excluído",
  "transaction.restore": "Lançamento restaurado",
  "transaction.cancel": "Lançamento cancelado",
  "bank_account.create": "Caixa criado",
  "bank_account.update": "Caixa atualizado",
  "bank_account.delete": "Caixa removido",
};

const ENTITY_LABELS: Record<string, string> = {
  financial_transaction: "Lançamentos",
  bank_account: "Caixa",
};

export function FinanceiroHistoricoClientes() {
  const { user } = useAuth();
  const isCliente = user?.role === "cliente";
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clientOptions, setClientOptions] = useState<ClientListItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedEntity, setSelectedEntity] = useState<string>("all");
  const [selectedOrigin, setSelectedOrigin] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        if (isCliente) {
          const client = await clientsApi.getMe();
          if (active) {
            setClientOptions([
              {
                id: client.id,
                razao_social: client.razao_social,
                nome_fantasia: client.nome_fantasia,
                cnpj: client.cnpj,
                email: client.email,
                status: client.status,
                honorarios_mensais: client.honorarios_mensais,
                regime_tributario: client.regime_tributario,
                tipo_empresa: client.tipo_empresa,
                created_at: client.created_at,
                updated_at: client.updated_at,
                codigo_simples: client.codigo_simples,
                cpf_empresa: client.cpf_empresa,
                senha_sistema: client.senha_sistema,
                senha_gov: client.senha_gov,
                senha_prefeitura: client.senha_prefeitura,
                login_seg_desemp: client.login_seg_desemp,
                senha_seg_desemp: client.senha_seg_desemp,
                email_seg_desemp: client.email_seg_desemp,
                senha_nfse: client.senha_nfse,
                senha_certificado_digital: client.senha_certificado_digital,
              },
            ]);
            setSelectedClientId(client.id);
          }
          return;
        }

        const response = await clientsApi.list({ size: 0 });
        if (active) {
          setClientOptions(response.items);
        }
      } catch (error) {
        console.error("Erro ao carregar clientes", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [isCliente, user]);

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
        setLogs(response.items);
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

  const getOriginKey = (log: AuditLog): "cliente" | "escritorio" => {
    const role = (log.user_role ?? "").toLowerCase();
    return role === "cliente" ? "cliente" : "escritorio";
  };

  const getOriginLabel = (log: AuditLog) =>
    getOriginKey(log) === "cliente" ? "Cliente" : "Escritório";

  const renderClientName = (log: AuditLog) => {
    const clientId = log.payload?.client_id as string | undefined;
    if (!clientId) {
      const isOfficeAccount = Boolean(log.payload?.is_office_account);
      if (isOfficeAccount || getOriginKey(log) === "escritorio") {
        return "Escritório";
      }
      return "-";
    }
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
      ["name", "Caixa"],
      ["account_number", "Identificador"],
      ["balance", "Saldo"],
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
      return [name, account, balance].filter(Boolean).join(" - ") || "Caixa";
    }
    return log.action;
  };

  const visibleLogs = useMemo(() => {
    let filtered = selectedOrigin === "all" ? logs : logs.filter((log) => getOriginKey(log) === selectedOrigin);
    const query = searchQuery.trim().toLowerCase();
    if (!query) return filtered;
    return filtered.filter((log) => {
      const details = [
        ACTION_LABELS[log.action] ?? log.action,
        String(log.payload?.description ?? ""),
        String(log.payload?.summary ?? ""),
        log.user_name ?? "",
        log.user_email ?? "",
        (() => { const c = clientMap.get(log.payload?.client_id as string); return c ? (c.nome_fantasia || c.razao_social) : ""; })(),
      ].join(" ").toLowerCase();
      return details.includes(query);
    });
  }, [logs, selectedOrigin, searchQuery, clientMap]);

  return (
    <Card className="border border-default-200/50 dark:border-default-100/20">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Histórico de Ações Financeiras
          </h3>
          <p className="text-sm text-default-500">
            Acompanhe ações feitas por usuários do escritório e clientes
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            size="sm"
            placeholder="Buscar por ação, descrição ou usuário..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            startContent={<Search className="h-4 w-4 text-default-400" />}
            isClearable
            onClear={() => setSearchQuery("")}
            className="w-full sm:min-w-[240px] sm:w-auto"
            aria-label="Buscar no histórico"
          />
          {!isCliente && (
            <Select
              label="Cliente"
              selectedKeys={[selectedClientId]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string | undefined;
                setSelectedClientId(value ?? "all");
              }}
              className="w-full sm:min-w-[220px] sm:w-auto"
              items={[{ id: "all", label: "Todos" }, ...clientOptions.map((c) => ({ id: c.id, label: c.nome_fantasia || c.razao_social }))]}
            >
              {(item) => <SelectItem key={item.id}>{item.label}</SelectItem>}
            </Select>
          )}
          <Select
            label="Tipo"
            selectedKeys={[selectedEntity]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string | undefined;
              setSelectedEntity(value ?? "all");
            }}
            className="w-full sm:min-w-[180px] sm:w-auto"
          >
            <SelectItem key="all">Todos</SelectItem>
            <SelectItem key="financial_transaction">Lançamentos</SelectItem>
            <SelectItem key="bank_account">Caixa</SelectItem>
          </Select>
          <Select
            label="Origem"
            selectedKeys={[selectedOrigin]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string | undefined;
              setSelectedOrigin(value ?? "all");
            }}
            className="w-full sm:min-w-[180px] sm:w-auto"
          >
            <SelectItem key="all">Todos</SelectItem>
            <SelectItem key="escritorio">Escritório</SelectItem>
            <SelectItem key="cliente">Cliente</SelectItem>
          </Select>
        </div>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table aria-label="Histórico de ações" removeWrapper className="min-w-[1040px]">
              <TableHeader>
                <TableColumn>Data</TableColumn>
                <TableColumn>Cliente</TableColumn>
                <TableColumn>Origem</TableColumn>
                <TableColumn>Usuário</TableColumn>
                <TableColumn>Tipo</TableColumn>
                <TableColumn>Detalhes</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Nenhuma ação registrada">
                {visibleLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDateTime(log.created_at)}</TableCell>
                    <TableCell>{renderClientName(log)}</TableCell>
                    <TableCell>{getOriginLabel(log)}</TableCell>
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
          </div>
        )}
      </CardBody>
    </Card>
  );
}
