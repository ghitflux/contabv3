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
import { useAuth } from "@/hooks/auth/AuthContext";
import { formatDateTime } from "@/lib/masks";
import type { AuditLog } from "@/types/audit";
import type { ClientListItem } from "@/types/client";

const ACTION_LABELS: Record<string, string> = {
  "license.create": "Licença criada",
  "license.update": "Licença atualizada",
  "license.renew": "Licença renovada",
  "license.delete": "Movida para lixeira",
  "license.restore": "Licença restaurada",
};

type OriginFilter = "all" | "office" | "client";

interface LicencasHistoricoProps {
  officeClientId?: string | null;
}

function getOriginKey(log: AuditLog, officeClientId?: string | null): "office" | "client" {
  const payloadClientId = typeof log.payload?.client_id === "string" ? log.payload.client_id : null;
  if (officeClientId && payloadClientId === officeClientId) {
    return "office";
  }
  return "client";
}

function getActionLabel(action: string) {
  return ACTION_LABELS[action] || action;
}

export function LicencasHistorico({ officeClientId }: LicencasHistoricoProps) {
  const { user } = useAuth();
  const isCliente = user?.role === "cliente";
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clientOptions, setClientOptions] = useState<ClientListItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedOrigin, setSelectedOrigin] = useState<OriginFilter>("all");
  const actionOptions = useMemo(
    () => [
      { id: "all", label: "Todas" },
      ...Object.entries(ACTION_LABELS).map(([key, label]) => ({ id: key, label })),
    ],
    [],
  );

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        if (isCliente) {
          const client = await clientsApi.getMe();
          if (!active) return;
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
          setSelectedOrigin("client");
          return;
        }

        const response = await clientsApi.list({ size: 0 });
        if (!active) return;
        setClientOptions(response.items);
      } catch (error) {
        console.error("Erro ao carregar clientes para histórico de licenças", error);
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
          entity: "license",
          client_id: selectedClientId !== "all" ? selectedClientId : undefined,
          action: selectedAction !== "all" ? selectedAction : undefined,
          limit: 200,
        });
        if (!active) return;
        setLogs(response.items);
      } catch (error) {
        console.error("Erro ao carregar histórico de licenças", error);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedAction, selectedClientId]);

  const clientMap = useMemo(() => {
    const map = new Map<string, ClientListItem>();
    clientOptions.forEach((client) => map.set(client.id, client));
    return map;
  }, [clientOptions]);

  const visibleLogs = useMemo(() => {
    if (selectedOrigin === "all") return logs;
    return logs.filter((log) => getOriginKey(log, officeClientId) === selectedOrigin);
  }, [logs, selectedOrigin, officeClientId]);

  const renderClientName = (log: AuditLog) => {
    const payloadClientId = typeof log.payload?.client_id === "string" ? log.payload.client_id : null;
    const payloadClientName = typeof log.payload?.client_name === "string" ? log.payload.client_name : null;

    if (payloadClientId && officeClientId && payloadClientId === officeClientId) {
      return "Escritório";
    }
    if (payloadClientId) {
      const client = clientMap.get(payloadClientId);
      if (client) return client.nome_fantasia || client.razao_social;
    }
    if (payloadClientName) return payloadClientName;
    return "-";
  };

  const renderDetails = (log: AuditLog) => {
    const summary = typeof log.payload?.summary === "string" ? log.payload.summary : "";
    if (summary) return summary;
    const registration = typeof log.payload?.registration_number === "string" ? log.payload.registration_number : "";
    const licenseType = typeof log.payload?.license_type === "string" ? log.payload.license_type : "";
    return [licenseType, registration].filter(Boolean).join(" - ") || log.action;
  };

  return (
    <Card className="border border-default-200/50 dark:border-default-100/20">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Histórico de Alterações de Licenças
          </h3>
          <p className="text-sm text-default-500">
            Acompanhe mudanças em licenças de clientes e do escritório
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {!isCliente && (
            <Select
              label="Cliente"
              selectedKeys={[selectedClientId]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string | undefined;
                setSelectedClientId(value ?? "all");
              }}
              className="min-w-[220px]"
              items={[
                { id: "all", label: "Todos" },
                ...clientOptions.map((client) => ({
                  id: client.id,
                  label: client.nome_fantasia || client.razao_social,
                })),
              ]}
            >
              {(item) => <SelectItem key={item.id}>{item.label}</SelectItem>}
            </Select>
          )}
          <Select
            label="Ação"
            selectedKeys={[selectedAction]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string | undefined;
              setSelectedAction(value ?? "all");
            }}
            className="min-w-[220px]"
            items={actionOptions}
          >
            {(item) => <SelectItem key={item.id}>{item.label}</SelectItem>}
          </Select>
          {!isCliente && (
            <Select
              label="Origem"
              selectedKeys={[selectedOrigin]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as OriginFilter | undefined;
                setSelectedOrigin(value ?? "all");
              }}
              className="min-w-[180px]"
            >
              <SelectItem key="all">Todos</SelectItem>
              <SelectItem key="office">Escritório</SelectItem>
              <SelectItem key="client">Cliente</SelectItem>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            {isCliente ? (
              <Table aria-label="Histórico de licenças" removeWrapper>
                <TableHeader>
                  <TableColumn>Data</TableColumn>
                  <TableColumn>Empresa</TableColumn>
                  <TableColumn>Usuário</TableColumn>
                  <TableColumn>Ação</TableColumn>
                  <TableColumn>Detalhes</TableColumn>
                </TableHeader>
                <TableBody emptyContent="Nenhuma alteração registrada">
                  {visibleLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDateTime(log.created_at)}</TableCell>
                      <TableCell>{renderClientName(log)}</TableCell>
                      <TableCell>{log.user_name || log.user_email || "-"}</TableCell>
                      <TableCell>{getActionLabel(log.action)}</TableCell>
                      <TableCell>{renderDetails(log)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table aria-label="Histórico de licenças" removeWrapper>
                <TableHeader>
                  <TableColumn>Data</TableColumn>
                  <TableColumn>Empresa</TableColumn>
                  <TableColumn>Origem</TableColumn>
                  <TableColumn>Usuário</TableColumn>
                  <TableColumn>Ação</TableColumn>
                  <TableColumn>Detalhes</TableColumn>
                </TableHeader>
                <TableBody emptyContent="Nenhuma alteração registrada">
                  {visibleLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDateTime(log.created_at)}</TableCell>
                      <TableCell>{renderClientName(log)}</TableCell>
                      <TableCell>
                        {getOriginKey(log, officeClientId) === "office" ? "Escritório" : "Cliente"}
                      </TableCell>
                      <TableCell>{log.user_name || log.user_email || "-"}</TableCell>
                      <TableCell>{getActionLabel(log.action)}</TableCell>
                      <TableCell>{renderDetails(log)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
