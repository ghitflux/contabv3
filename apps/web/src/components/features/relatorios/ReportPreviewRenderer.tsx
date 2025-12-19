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
import type { ReportPreviewResponse } from "@/types/report";
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
            {renderDataSection(preview.data)}
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
