"use client";

import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Skeleton,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@/heroui";
import { ReportType, type ReportPreviewResponse } from "@/types/report";
import { formatCurrency, formatDate } from "@/lib/masks";

interface ReportPreviewRendererProps {
  preview: ReportPreviewResponse | null;
  isLoading?: boolean;
}

/**
 * Component to render report preview data
 */
export function ReportPreviewRenderer({
  preview,
  isLoading = false,
}: ReportPreviewRendererProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!preview) {
    return (
      <Card>
        <CardBody>
          <p className="text-center text-default-500">
            Nenhuma prévia de relatório disponível. Configure os filtros e clique em "Visualizar Prévia".
          </p>
        </CardBody>
      </Card>
    );
  }

  const customPreview = renderSpecializedPreview(preview);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold">Prévia do Relatório</h3>
          <div className="flex gap-4 text-sm text-default-500">
            <span>Gerado em: {formatDate(preview.generated_at)}</span>
            <span>Registros: {preview.record_count}</span>
          </div>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="gap-6">
        {/* Summary Section */}
        {preview.summary && Object.keys(preview.summary).length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Resumo</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(preview.summary).map(([key, value]) => (
                <div key={key} className="p-3 bg-default-100 rounded-lg">
                  <p className="text-xs text-default-500 mb-1">
                    {formatFieldName(key)}
                  </p>
                  <p className="text-lg font-semibold">
                    {formatValue(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Section */}
        {preview.data && (
          <div>
            <h4 className="font-semibold mb-3">Dados</h4>
            {customPreview ?? renderDataSection(preview.data)}
          </div>
        )}

        {/* Charts Section */}
        {preview.charts_config && preview.charts_config.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Gráficos Configurados</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {preview.charts_config.map((chart, index) => (
                <div key={index} className="p-4 bg-default-50 rounded-lg">
                  <p className="font-medium">{chart.title || `Gráfico ${index + 1}`}</p>
                  <p className="text-sm text-default-500">
                    Tipo: {chart.type || "N/A"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function renderSpecializedPreview(preview: ReportPreviewResponse) {
  if (preview.report_type === ReportType.GERAL) {
    return renderGeneralReport(preview.data);
  }

  if (preview.report_type === ReportType.CLIENTES) {
    return renderClientsReport(preview.data);
  }

  if (preview.report_type === ReportType.OBRIGACOES) {
    return renderObligationsReport(preview.data);
  }

  return null;
}

function renderGeneralReport(data: Record<string, any>) {
  const empresa = data.empresa ?? {};
  const resumo = data.resumo_financeiro ?? {};
  const kpis = data.kpis ?? {};
  const analises = data.analises ?? {};
  const projecoes = data.projecoes ?? {};

  return (
    <div className="space-y-6">
      <section>
        <h5 className="text-sm font-medium mb-2">Dados da Empresa</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            ["Escopo", formatStatusLabel(empresa.escopo)],
            ["Nome", empresa.nome],
            ["CNPJ", empresa.cnpj],
            ["E-mail", empresa.email],
            ["Telefone", empresa.telefone],
            ["Endereço", empresa.endereco],
          ]
            .filter(([, value]) => Boolean(value))
            .map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 p-2 bg-default-50 rounded">
                <span className="text-sm text-default-600">{label}</span>
                <span className="text-sm font-medium text-right">{value}</span>
              </div>
            ))}
        </div>
      </section>

      <section>
        <h5 className="text-sm font-medium mb-2">Resumo Financeiro</h5>
        {renderMetricGrid([
          ["Receita Total", formatCurrency(resumo.receita_total ?? 0)],
          ["Despesa Total", formatCurrency(resumo.despesa_total ?? 0)],
          ["Resultado Líquido", formatCurrency(resumo.resultado_liquido ?? 0)],
          ["Margem de Lucro", formatPercent(resumo.margem_lucro ?? 0)],
          ["Margem Operacional", formatPercent(kpis.margem_operacional ?? 0)],
        ])}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h5 className="text-sm font-medium mb-2">Principais Receitas</h5>
          {renderDataTable(analises.principais_receitas ?? [])}
        </div>
        <div>
          <h5 className="text-sm font-medium mb-2">Principais Despesas</h5>
          {renderDataTable(analises.principais_despesas ?? [])}
        </div>
      </section>

      <section>
        <h5 className="text-sm font-medium mb-2">Evolução Mensal</h5>
        {renderDataTable(data.evolucao_mensal ?? [])}
      </section>

      <section>
        <h5 className="text-sm font-medium mb-2">Projeções</h5>
        <p className="text-xs text-default-500 mb-2">
          {projecoes.metodo_projecao}
        </p>
        {renderDataTable(projecoes.periodos ?? [])}
      </section>
    </div>
  );
}

function renderClientsReport(data: Record<string, any>) {
  return (
    <div className="space-y-6">
      {renderMetricGrid([
        ["Total de Clientes", formatValue(data.total_clientes)],
        ["Clientes Ativos", formatValue(data.total_clientes_ativos)],
        ["Honorários Mensais", formatCurrency(data.total_honorarios ?? 0)],
      ])}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h5 className="text-sm font-medium mb-2">Classificação por Regime</h5>
          {renderDataTable(
            (data.por_regime ?? []).map((item: any) => ({
              regime: formatRegimeLabel(item.regime),
              total: item.total,
            }))
          )}
        </div>
        <div>
          <h5 className="text-sm font-medium mb-2">Classificação por Status</h5>
          {renderDataTable(
            (data.por_status ?? []).map((item: any) => ({
              status: formatStatusLabel(item.status),
              total: item.total,
            }))
          )}
        </div>
      </section>

      <section>
        <h5 className="text-sm font-medium mb-2">Clientes</h5>
        {renderDataTable(
          (data.clients ?? []).map((client: any) => ({
            cliente: client.nome_fantasia || client.razao_social,
            cnpj: client.cnpj,
            status: formatStatusLabel(client.status),
            regime: formatRegimeLabel(client.regime_tributario),
            honorarios: client.honorarios,
            pendente: client.total_pendente,
            atrasado: client.total_atrasado,
          }))
        )}
      </section>
    </div>
  );
}

function renderObligationsReport(data: Record<string, any>) {
  return (
    <div className="space-y-6">
      {renderMetricGrid([
        ["Total", formatValue(data.total_obligations)],
        ["Pendentes", formatValue(data.pending)],
        ["Entregues", formatValue(data.completed)],
        ["Em Atraso", formatValue(data.overdue)],
        ["Compliance", formatPercent(data.compliance_rate ?? 0)],
      ])}

      <section>
        <h5 className="text-sm font-medium mb-2">Totais por Status</h5>
        {renderDataTable(
          (data.totais_por_status ?? []).map((item: any) => ({
            status: formatStatusLabel(item.status),
            total: item.total,
          }))
        )}
      </section>

      <section>
        <h5 className="text-sm font-medium mb-2">Obrigações por Cliente</h5>
        {renderDataTable(
          (data.obligations ?? []).map((obligation: any) => ({
            cliente: obligation.client_name,
            cnpj: obligation.client_cnpj,
            obrigacao: obligation.obligation_name,
            status: formatStatusLabel(obligation.status),
            competencia: obligation.competencia,
            vencimento: obligation.due_date,
            prioridade: formatStatusLabel(obligation.priority),
          }))
        )}
      </section>
    </div>
  );
}

function renderMetricGrid(items: Array<[string, string]>) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map(([label, value]) => (
        <div key={label} className="p-3 bg-default-100 rounded-lg">
          <p className="text-xs text-default-500 mb-1">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Render data section based on data structure
 */
function renderDataSection(data: Record<string, any>) {
  // If data is an array, render as table
  if (Array.isArray(data)) {
    return renderDataTable(data);
  }

  // If data has array properties, render each as a section
  const arrayKeys = Object.keys(data).filter((key) => Array.isArray(data[key]));
  if (arrayKeys.length > 0) {
    return (
      <div className="space-y-6">
        {arrayKeys.map((key) => (
          <div key={key}>
            <h5 className="text-sm font-medium mb-2">{formatFieldName(key)}</h5>
            {renderDataTable(data[key])}
          </div>
        ))}
      </div>
    );
  }

  // Otherwise, render as key-value pairs
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex justify-between p-2 bg-default-50 rounded">
          <span className="text-sm text-default-600">{formatFieldName(key)}:</span>
          <span className="text-sm font-medium">{formatValue(value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Render array data as a table
 */
function renderDataTable(data: any[]) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-default-500">Nenhum dado disponível</p>;
  }

  // Get columns from first item
  const firstItem = data[0];
  const columns = Object.keys(firstItem);

  // Limit to first 10 rows for preview
  const previewData = data.slice(0, 10);
  const hasMore = data.length > 10;

  return (
    <div>
      <Table aria-label="Data table" className="min-w-full">
        <TableHeader>
          {columns.map((col) => (
            <TableColumn key={col}>{formatFieldName(col)}</TableColumn>
          ))}
        </TableHeader>
        <TableBody>
          {previewData.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((col) => (
                <TableCell key={col}>{formatValue(row[col])}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hasMore && (
        <p className="text-sm text-default-500 mt-2 text-center">
          ... e mais {data.length - 10} registros
        </p>
      )}
    </div>
  );
}

/**
 * Format field name for display
 */
function formatFieldName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format value based on type
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return "N/A";
  }

  if (typeof value === "number") {
    // Try to detect if it's a currency value (common field names)
    const str = String(value);
    if (str.includes(".") && (str.split(".")[1]?.length || 0) === 2) {
      return formatCurrency(value);
    }
    return value.toLocaleString("pt-BR");
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  // Try to detect and format dates (ISO string)
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      return formatDate(value);
    } catch {
      return value;
    }
  }

  return String(value);
}

function formatPercent(value: any): string {
  const numeric = Number(value || 0);
  return `${numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatStatusLabel(value: any): string {
  const labels: Record<string, string> = {
    escritorio: "Escritório",
    cliente: "Cliente",
    consolidado: "Consolidado",
    ativo: "Ativo",
    inativo: "Inativo",
    inadimplente: "Inadimplente",
    pendente: "Pendente",
    em_andamento: "Em andamento",
    concluida: "Entregue",
    atrasada: "Em atraso",
    cancelada: "Cancelada",
    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
    urgente: "Urgente",
  };
  if (!value) return "N/A";
  const key = String(value).toLowerCase();
  return labels[key] ?? String(value);
}

function formatRegimeLabel(value: any): string {
  const labels: Record<string, string> = {
    simples_nacional: "Simples Nacional",
    lucro_presumido: "Lucro Presumido",
    lucro_real: "Lucro Real",
    mei: "MEI",
  };
  if (!value) return "N/A";
  const key = String(value).toLowerCase();
  return labels[key] ?? String(value);
}
