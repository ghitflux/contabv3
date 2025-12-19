"use client";

import { Card, CardBody, CardHeader, Button, Spinner } from "@/heroui";
import { useEffect, useState } from "react";
import { useReports } from "@/hooks/useReports";
import { useReportPreview } from "@/hooks/useReportPreview";
import { useReportExport } from "@/hooks/useReportExport";
// import type { ReportTypeInfo } from "@/types/report";
import {
  ReportType as ReportTypeEnum,
  ReportFormat,
} from "@/types/report";
import { format } from "date-fns";
import { getReportTypeLabel } from "@/types/report";
import { ReportPreviewRenderer } from "@/components/features/relatorios/ReportPreviewRenderer";
import { EyeIcon, DownloadIcon, FileTextIcon, CalendarIcon } from "@/lib/icons";
import { DatePickerField } from "@/components/ui/DatePickerField";

export default function PortalRelatoriosPage() {
  const { reportTypes, fetchReportTypes, loading } = useReports();
  const { previewReport, preview, isLoading: previewLoading } =
    useReportPreview();
  const { downloadReport, isExporting, exportReport } = useReportExport();

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState<string>(
    format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd")
  );
  const [periodEnd, setPeriodEnd] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );

  // Available report types for clients (filtered)
  const availableTypes = [
    ReportTypeEnum.DRE,
    ReportTypeEnum.FLUXO_CAIXA,
    ReportTypeEnum.KPIS,
  ];

  useEffect(() => {
    void fetchReportTypes();
  }, [fetchReportTypes]);

  const handlePreview = async (type: string) => {
    try {
      await previewReport({
        report_type: type as any,
        filters: {
          period_start: periodStart,
          period_end: periodEnd,
          report_type: type as any,
        },
        customizations: {
          include_summary: true,
          include_charts: true,
        },
      });
      setSelectedType(type);
    } catch (error) {
      console.error("Error generating preview:", error);
    }
  };

  const handleDownload = async (format: "pdf" | "csv" = "pdf") => {
    if (!selectedType || !preview) return;

    try {
      const result = await exportReport({
        report_type: selectedType as any,
        format: format === "pdf" ? ReportFormat.PDF : ReportFormat.CSV,
        filters: {
          period_start: periodStart,
          period_end: periodEnd,
          report_type: selectedType as any,
        },
        customizations: {
          include_summary: true,
          include_charts: true,
        },
      });

      if (result) {
        await downloadReport(result.report_id, result.file_name);
      }
    } catch (error) {
      console.error("Error downloading report:", error);
    }
  };

  const filteredTypes =
    reportTypes?.types.filter((t) => availableTypes.includes(t.type)) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Meus Relatórios</h1>
          <p className="text-default-500 mt-1">
            Visualize e baixe seus relatórios financeiros
          </p>
        </div>
      </div>

      {/* Period Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Selecionar Período</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <DatePickerField
                label="Data Inicial"
                value={periodStart}
                onChange={setPeriodStart}
              />
            </div>
            <div className="flex-1">
              <DatePickerField
                label="Data Final"
                value={periodEnd}
                onChange={setPeriodEnd}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Available Reports */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Relatórios Disponíveis</h3>
        </CardHeader>
        <CardBody>
          {loading.reportTypes ? (
            <div className="flex justify-center items-center p-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredTypes.map((type) => (
                <Card key={type.type} className="border border-divider">
                  <CardBody>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold">{type.name}</h4>
                        <p className="text-sm text-default-500 mt-1">
                          {type.description}
                        </p>
                      </div>
                      <Button
                        color="primary"
                        variant="flat"
                        size="sm"
                        className="w-full"
                        onPress={() => handlePreview(type.type)}
                        isLoading={
                          previewLoading && selectedType === type.type
                        }
                        startContent={<EyeIcon className="h-4 w-4" />}
                      >
                        Visualizar
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Preview Section */}
      {selectedType && preview && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                Preview: {getReportTypeLabel(selectedType as any)}
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  onPress={() => handleDownload("pdf")}
                  isDisabled={isExporting}
                  startContent={<DownloadIcon className="h-4 w-4" />}
                >
                  Baixar PDF
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="default"
                  onPress={() => handleDownload("csv")}
                  isDisabled={isExporting}
                  startContent={<FileTextIcon className="h-4 w-4" />}
                >
                  Baixar CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <ReportPreviewRenderer preview={preview} isLoading={previewLoading} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
