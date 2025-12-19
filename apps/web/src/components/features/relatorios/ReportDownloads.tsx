"use client";

import { useEffect } from "react";
import { Card, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Button, Spinner } from "@/heroui";
import { useReportHistory } from "@/hooks/useReportHistory";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReportFormat } from "@/types/report";

interface ReportDownloadsProps {
  onEdit: () => void;
  refreshKey?: number;
}

const formatLabels: Record<string, { label: string; color: "primary" | "success" | "warning" }> = {
  pdf: { label: "PDF", color: "primary" },
  csv: { label: "CSV", color: "success" },
  xls: { label: "XLS", color: "warning" },
};

export function ReportDownloads({ onEdit, refreshKey }: ReportDownloadsProps) {
  const { history, isLoading, refresh, downloadReport } = useReportHistory({
    size: 20,
    autoFetch: true,
  });

  useEffect(() => {
    if (refreshKey !== undefined) {
      refresh();
    }
  }, [refreshKey, refresh]);

  if (isLoading && !history) {
    return (
      <Card>
        <CardBody className="flex items-center justify-center gap-2">
          <Spinner size="sm" /> Carregando relatórios gerados...
        </CardBody>
      </Card>
    );
  }

  if (!history || history.items.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-10 space-y-2">
          <p className="font-semibold">Nenhum relatório gerado ainda.</p>
          <p className="text-default-500 text-sm">Use a aba de Relatórios Essenciais ou clique em Relatório Customizado para gerar.</p>
          <Button color="primary" variant="flat" size="sm" onPress={onEdit}>
            Criar relatório customizado
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">Relatórios gerados</h3>
            <p className="text-sm text-default-500">
              {history.total} arquivo{history.total !== 1 ? "s" : ""} disponível{history.total !== 1 ? "s" : ""} para download
            </p>
          </div>
          <Button size="sm" variant="flat" onPress={refresh}>
            Atualizar
          </Button>
        </div>
        <Table aria-label="Relatórios gerados">
          <TableHeader>
            <TableColumn>Título</TableColumn>
            <TableColumn>Formato</TableColumn>
            <TableColumn>Período</TableColumn>
            <TableColumn>Gerado em</TableColumn>
            <TableColumn>Ações</TableColumn>
          </TableHeader>
          <TableBody>
            {history.items.map((item) => {
              const formatInfo = formatLabels[item.format] || { label: item.format.toUpperCase(), color: "primary" as const };
              const periodStart = item.filters_used?.period_start;
              const periodEnd = item.filters_used?.period_end;
              const period =
                periodStart && periodEnd
                  ? `${periodStart} a ${periodEnd}`
                  : "Período não informado";

              return (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold capitalize">{item.report_type.replace("_", " ")}</TableCell>
                  <TableCell>
                    <Chip size="sm" color={formatInfo.color} variant="flat">
                      {formatInfo.label}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-sm text-default-500">{period}</TableCell>
                  <TableCell className="text-sm text-default-500">
                    {format(new Date(item.generated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="bordered"
                      onPress={() => downloadReport(item.id, item.file_path?.split("/").pop())}
                    >
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}
