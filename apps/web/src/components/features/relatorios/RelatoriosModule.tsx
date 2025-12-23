"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button, Card, CardBody, CardHeader, Chip, Tabs, Tab, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Switch, Input } from "@/heroui";
import { pageTransition, fadeIn } from "@/lib/animations";
import {
  PlusIcon,
  FileTextIcon,
  BarChartIcon,
  TrendingUpIcon,
  DollarSignIcon,
  PieChartIcon,
  CalendarIcon,
} from "@/lib/icons";
import { Activity, Target } from "lucide-react";
import { ReportBuilder } from "./ReportBuilder";
import { ReportDownloads } from "./ReportDownloads";
import { ReportFormat, ReportType } from "@/types/report";
import { reportsApi } from "@/lib/api/endpoints/reports";
import { toast } from "@/lib/toast";
import { startOfMonth, formatISO } from "date-fns";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { useAuth } from "@/hooks/auth/AuthContext";
import { clientsApi } from "@/lib/api/endpoints/clients";
import type { ClientListItem } from "@/types/client";

const financialReports = [
  {
    type: ReportType.DRE,
    title: "DRE Simplificada",
    description: "Demonstrativo de Resultados - Receita total menos Despesas operacionais",
    icon: TrendingUpIcon,
    color: "teal",
  },
  {
    type: ReportType.FLUXO_CAIXA,
    title: "Fluxo de Caixa",
    description: "Entradas e saídas de dinheiro mês a mês",
    icon: Activity,
    color: "blue",
  },
  {
    type: ReportType.LIVRO_CAIXA,
    title: "Livro Caixa",
    description: "Todas as movimentações financeiras em ordem cronológica",
    icon: FileTextIcon,
    color: "slate",
    highlight: true,
    features: ["Saldo acumulado por movimento", "Filtro por cliente ou escritório", "Ideal para conciliação diária"],
  },
  {
    type: ReportType.RECEITAS_CLIENTE,
    title: "Receitas por Cliente",
    description: "Quanto cada cliente gerou em receita no período",
    icon: DollarSignIcon,
    color: "green",
  },
  {
    type: ReportType.DESPESAS_CATEGORIA,
    title: "Despesas por Categoria",
    description: "Despesas classificadas em grupos (folha, marketing, aluguel, etc.)",
    icon: PieChartIcon,
    color: "amber",
  },
  {
    type: ReportType.PROJECAO_FLUXO,
    title: "Projeção de Fluxo de Caixa",
    description: "Previsão de entradas e saídas futuras com base no histórico",
    icon: CalendarIcon,
    color: "purple",
  },
  {
    type: ReportType.KPIS,
    title: "Indicadores Financeiros (KPIs)",
    description: "Margem de lucro, despesas fixas, índice de inadimplência",
    icon: Target,
    color: "rose",
  },
];

export function RelatoriosModule() {
  const { user } = useAuth();
  // Exibir controles avançados para todos exceto cliente; por padrão (user indefinido) mostrar.
  const isAdminOrFunc = user?.role !== "cliente";
  const OFFICE_CLIENT_ID = process.env.NEXT_PUBLIC_OFFICE_CLIENT_ID ?? "";
  const [activeTab, setActiveTab] = useState("essenciais");
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [isGeneratingId, setIsGeneratingId] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState(formatISO(startOfMonth(new Date()), { representation: "date" }));
  const [rangeEnd, setRangeEnd] = useState(formatISO(new Date(), { representation: "date" }));
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>(ReportFormat.PDF);
  const [clientSearch, setClientSearch] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientListItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isOfficeReport, setIsOfficeReport] = useState(false);

  useEffect(() => {
    if (!isAdminOrFunc || !rangeModalOpen) return;
    let active = true;
    (async () => {
      try {
        const res = await clientsApi.list({ query: clientSearch || undefined, size: 20 });
        if (active) setClientOptions(res.items);
      } catch (error) {
        console.error("Erro ao buscar clientes para relatório", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [clientSearch, isAdminOrFunc, rangeModalOpen]);

  const handleOpenRangeModal = (reportType: ReportType) => {
    setSelectedReport(reportType);
    setRangeModalOpen(true);
  };

  const handleGenerateWithRange = async () => {
    if (!selectedReport) return;
    setIsGeneratingId(selectedReport);

    if (rangeStart > rangeEnd) {
      toast.error("A data inicial deve ser anterior à data final.");
      setIsGeneratingId(null);
      return;
    }

    // Validate client selection for admin/func
    let clientIds: string[] | undefined = undefined;
    if (isAdminOrFunc) {
      if (isOfficeReport && OFFICE_CLIENT_ID) {
        clientIds = [OFFICE_CLIENT_ID];
      } else if (!isOfficeReport && selectedClientId) {
        clientIds = [selectedClientId];
      } else if (!isOfficeReport) {
        toast.error("Selecione um cliente ou marque como relatório do escritório.");
        setIsGeneratingId(null);
        return;
      }
    }

    try {
      const reportType = selectedReport;
      const response = await reportsApi.exportReport({
        report_type: reportType,
        format: selectedFormat,
        filters: {
          period_start: rangeStart,
          period_end: rangeEnd,
          report_type: reportType,
          client_ids: clientIds,
        },
        customizations: {
          include_summary: true,
          include_charts: true,
        },
        filename: `${reportType}-${rangeEnd}`,
      });

      toast.success("Relatório gerado com sucesso. Baixando arquivo...");
      const { blob, filename } = await reportsApi.downloadReport(response.report_id, response.file_name);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setHistoryRefreshKey((prev) => prev + 1);
      setRangeModalOpen(false);
    } catch (error) {
      console.error("Erro ao gerar relatório", error);
      toast.error("Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setIsGeneratingId(null);
    }
  };

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      teal: "bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900",
      blue: "bg-primary-50 dark:bg-primary-950/20 border-primary-200 dark:border-primary-900",
      primary: "bg-primary-50 dark:bg-primary-950/20 border-primary-200 dark:border-primary-900",
      slate: "bg-slate-50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-900",
      green: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900",
      amber: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900",
      purple: "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900",
      rose: "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900",
    };
    return colorMap[color] || colorMap.slate;
  };

  const getTextColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      teal: "text-teal-700 dark:text-teal-400",
      blue: "text-primary-700 dark:text-primary-400",
      primary: "text-primary-700 dark:text-primary-400",
      slate: "text-slate-700 dark:text-slate-400",
      green: "text-green-700 dark:text-green-400",
      amber: "text-amber-700 dark:text-amber-400",
      purple: "text-purple-700 dark:text-purple-400",
      rose: "text-rose-700 dark:text-rose-400",
    };
    return colorMap[color] || colorMap.slate;
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
          <p className="text-default-500 mt-1">
            Relatórios financeiros essenciais e customizáveis
          </p>
        </div>
        <Button
          onClick={() => setShowBuilder(true)}
          color="primary"
          className="gap-2"
          startContent={<PlusIcon className="h-4 w-4" />}
        >
          Relatório Customizado
        </Button>
      </div>

      {showBuilder ? (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={fadeIn}
        >
          <ReportBuilder onClose={() => setShowBuilder(false)} />
        </motion.div>
      ) : (
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          color="primary"
        >
          <Tab
            key="essenciais"
            title={
              <div className="flex items-center gap-2">
                <BarChartIcon className="h-4 w-4" />
                Relatórios Essenciais
              </div>
            }
          >
            <motion.div
              key="essenciais"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={fadeIn}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6"
            >
              {financialReports.map((report) => {
                const Icon = report.icon;
                const bgClasses = getColorClasses(report.color);
                const textClasses = getTextColorClasses(report.color);
                const isHighlight = Boolean(report.highlight);

                return (
                  <Card
                    key={report.type}
                    className={`${bgClasses} border relative overflow-hidden ${isHighlight ? "md:col-span-2" : ""}`}
                  >
                    {isHighlight && (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.18),_transparent_60%)] pointer-events-none" />
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-5 w-5 ${textClasses}`} />
                            <h3 className={`text-lg font-semibold ${textClasses}`}>
                              {report.title}
                            </h3>
                            {isHighlight && (
                              <Chip size="sm" variant="flat" color="primary">
                                Destaque
                              </Chip>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardBody>
                      <p className={`text-sm mb-4 opacity-90 ${textClasses}`}>
                        {report.description}
                      </p>
                      {report.features && report.features.length > 0 && (
                        <div className="mb-4 space-y-1 text-xs text-default-600">
                          {report.features.map((feature) => (
                            <div key={feature} className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button
                        onClick={() => handleOpenRangeModal(report.type)}
                        variant="bordered"
                        size="sm"
                        className="w-full"
                        isLoading={isGeneratingId === report.type}
                        isDisabled={Boolean(isGeneratingId)}
                      >
                        {isGeneratingId === report.type ? "Gerando..." : "Gerar Relatório"}
                      </Button>
                    </CardBody>
                  </Card>
                );
              })}
            </motion.div>

            {/* Informações sobre os relatórios */}
            <motion.div
              key="essenciais-info"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={fadeIn}
            >
              <Card className="mt-6">
              <CardHeader>
                <h3 className="text-lg font-semibold">
                  Sobre os Relatórios Financeiros
                </h3>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">
                    1. DRE Simplificada
                  </h4>
                  <p className="text-sm text-default-500">
                    Mostra o lucro ou prejuízo do período através da fórmula:
                    Receita total – Despesas operacionais = Resultado líquido
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">
                    2. Fluxo de Caixa
                  </h4>
                  <p className="text-sm text-default-500">
                    Visualize entradas e saídas de dinheiro mês a mês para
                    prever necessidades de capital
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">3. Livro Caixa</h4>
                  <p className="text-sm text-default-500">
                    Registro completo de todas as movimentações financeiras,
                    ideal para controle diário e conciliação bancária
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">
                    4. Receitas por Cliente
                  </h4>
                  <p className="text-sm text-default-500">
                    Identifique seus clientes mais rentáveis através da análise
                    de receita gerada por cada um
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">
                    5. Despesas por Categoria
                  </h4>
                  <p className="text-sm text-default-500">
                    Controle de custos através da classificação de despesas em
                    grupos como folha, marketing, aluguel, etc.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">
                    6. Projeção de Fluxo de Caixa
                  </h4>
                  <p className="text-sm text-default-500">
                    Planejamento financeiro através da previsão de entradas e
                    saídas futuras baseadas no histórico
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">
                    7. Indicadores Financeiros (KPIs)
                  </h4>
                  <p className="text-sm text-default-500">
                    Métricas essenciais: margem de lucro, percentual de despesas
                    fixas sobre receita e índice de inadimplência
                  </p>
                </div>
              </CardBody>
            </Card>
            </motion.div>
          </Tab>

          <Tab
            key="downloads"
            title={
              <div className="flex items-center gap-2">
                <FileTextIcon className="h-4 w-4" />
                Downloads
              </div>
            }
          >
            <motion.div
              key="downloads"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={fadeIn}
              className="mt-6"
            >
              <ReportDownloads onEdit={() => setShowBuilder(true)} refreshKey={historyRefreshKey} />
            </motion.div>
          </Tab>
        </Tabs>
      )}

      <Modal isOpen={rangeModalOpen} onOpenChange={(open) => setRangeModalOpen(open)}>
        <ModalContent>
          <ModalHeader>Selecionar período</ModalHeader>
          <ModalBody className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <DatePickerField
                label="Início"
                value={rangeStart}
                onChange={setRangeStart}
                size="md"
                className="flex-1"
                aria-label="Data de início"
              />
              <DatePickerField
                label="Fim"
                value={rangeEnd}
                onChange={setRangeEnd}
                size="md"
                className="flex-1"
                aria-label="Data de fim"
              />
            </div>
            <Select
              label="Formato"
              selectedKeys={[selectedFormat]}
              onSelectionChange={(keys) => {
                const key = Array.from(keys)[0] as ReportFormat;
                if (key) setSelectedFormat(key);
              }}
            >
              <SelectItem key={ReportFormat.PDF} value={ReportFormat.PDF}>
                PDF
              </SelectItem>
              <SelectItem key={ReportFormat.CSV} value={ReportFormat.CSV}>
                CSV
              </SelectItem>
              <SelectItem key={ReportFormat.XLS} value={ReportFormat.XLS}>
                XLS
              </SelectItem>
            </Select>
            {isAdminOrFunc && (
              <div className="space-y-3">
                <Switch
                  isSelected={isOfficeReport}
                  onValueChange={(v) => {
                    setIsOfficeReport(v);
                    if (v) setSelectedClientId(null);
                  }}
                >
                  Relatório do escritório
                </Switch>
                {!isOfficeReport && (
                  <div className="space-y-2">
                    <Input
                      label="Cliente"
                      placeholder="Buscar por nome/razão social"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                    />
                    <Select
                      label="Selecionar cliente"
                      selectedKeys={selectedClientId ? [selectedClientId] : []}
                      onSelectionChange={(keys) => {
                        const key = Array.from(keys)[0] as string;
                        setSelectedClientId(key || null);
                        setIsOfficeReport(false);
                      }}
                    >
                      {clientOptions.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.nome_fantasia || client.razao_social}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setRangeModalOpen(false)}>
              Cancelar
            </Button>
            <Button color="primary" onPress={handleGenerateWithRange} isLoading={Boolean(isGeneratingId)}>
              Gerar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}

