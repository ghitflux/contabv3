"use client";

import { Card, CardBody, CardHeader, Button, Skeleton, Chip } from "@/heroui";
import {
  FileTextIcon,
  DownloadIcon,
  RefreshIcon,
  CalendarIcon,
  FileIcon,
} from "@/lib/icons";
import { useReportHistory } from "@/hooks/useReportHistory";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCallback } from "react";
import { toast } from "@/lib/toast";

interface SavedReportsProps {
  onEdit: () => void;
  refreshKey?: number;
}

// Report type labels
const reportTypeLabels: Record<string, string> = {
  dre: "DRE",
  fluxo_caixa: "Fluxo de Caixa",
  livro_caixa: "Livro Caixa",
  receitas_cliente: "Receitas por Cliente",
  despesas_categoria: "Despesas por Categoria",
  projecao_fluxo: "Projeção de Fluxo",
  kpis: "KPIs Financeiros",
  clientes: "Clientes",
  obrigacoes: "Obrigações",
  licencas: "Licenças",
  auditoria: "Auditoria",
};

// Format labels
const formatLabels: Record<string, { label: string; color: "primary" | "success" }> = {
  pdf: { label: "PDF", color: "primary" },
  csv: { label: "CSV", color: "success" },
};

export function SavedReports({ onEdit, refreshKey }: SavedReportsProps) {
  const { history, isLoading, refresh, downloadReport } = useReportHistory({
    size: 20,
    autoFetch: true,
  });

  // Permite que o módulo pai force o refresh após gerar um relatório
  useEffect(() => {
    if (refreshKey !== undefined) {
      refresh();
    }
  }, [refreshKey, refresh]);

  const handleDownload = useCallback(async (reportId: string) => {
    try {
      await downloadReport(reportId);
      toast.success("Download iniciado com sucesso!");
    } catch (error) {
      toast.error("Erro ao fazer download do relatório");
      console.error("Download error:", error);
    }
  }, [downloadReport]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading && !history) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-start gap-3 w-full">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-9 w-9" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  if (!history || history.items.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <FileIcon className="h-16 w-16 text-default-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            Nenhum relatório salvo
          </h3>
          <p className="text-default-500 mb-4">
            Gere seu primeiro relatório para começar.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-default-500">
          {history.total} relatório{history.total !== 1 ? "s" : ""} encontrado{history.total !== 1 ? "s" : ""}
        </p>
          <Button
            size="sm"
            variant="flat"
            startContent={<RefreshIcon className="h-4 w-4" />}
            onPress={refresh}
          >
            Atualizar
          </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {history.items.map((report) => {
          const formatInfo = formatLabels[report.format] || {
            label: report.format.toUpperCase(),
            color: "primary" as const,
          };

          return (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-start justify-between w-full">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-teal-100 dark:bg-teal-900 rounded-lg">
                      <FileTextIcon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">
                        {reportTypeLabels[report.report_type] || report.report_type}
                      </h3>
                      <p className="text-sm text-default-500 mt-1">
                        {report.filters_used.period_start} a {report.filters_used.period_end}
                      </p>
                    </div>
                  </div>
                  <Chip size="sm" color={formatInfo.color} variant="flat">
                    {formatInfo.label}
                  </Chip>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-default-500">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-4 w-4" />
                    <span>
                      {format(new Date(report.generated_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>

                {report.file_size && (
                  <div className="text-sm text-default-500">
                    Tamanho: {formatFileSize(report.file_size)}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="bordered"
                    size="sm"
                    className="flex-1 gap-2"
                    startContent={<DownloadIcon className="h-4 w-4" />}
                    onPress={() => handleDownload(report.id)}
                  >
                    Download
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Pagination info */}
      {history.pages > 1 && (
        <div className="text-center text-sm text-default-500">
          Página {history.page} de {history.pages}
        </div>
      )}
    </div>
  );
}
