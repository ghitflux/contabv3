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
      teal: "bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/20 border-teal-200/60 dark:border-teal-800/40",
      blue: "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border-blue-200/60 dark:border-blue-800/40",
      primary: "bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-950/30 dark:to-blue-950/20 border-primary-200/60 dark:border-primary-800/40",
      slate: "bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/40 dark:to-gray-900/30 border-slate-200/60 dark:border-slate-700/40",
      green: "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20 border-emerald-200/60 dark:border-emerald-800/40",
      amber: "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border-amber-200/60 dark:border-amber-800/40",
      purple: "bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/20 border-purple-200/60 dark:border-purple-800/40",
      rose: "bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/20 border-rose-200/60 dark:border-rose-800/40",
    };
    return colorMap[color] || colorMap.slate;
  };

  const getTextColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      teal: "text-teal-700 dark:text-teal-300",
      blue: "text-blue-700 dark:text-blue-300",
      primary: "text-primary-700 dark:text-primary-300",
      slate: "text-slate-700 dark:text-slate-300",
      green: "text-emerald-700 dark:text-emerald-300",
      amber: "text-amber-700 dark:text-amber-300",
      purple: "text-purple-700 dark:text-purple-300",
      rose: "text-rose-700 dark:text-rose-300",
    };
    return colorMap[color] || colorMap.slate;
  };

  const getIconBgClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      teal: "bg-teal-100 dark:bg-teal-900/40",
      blue: "bg-blue-100 dark:bg-blue-900/40",
      primary: "bg-primary-100 dark:bg-primary-900/40",
      slate: "bg-slate-100 dark:bg-slate-800/40",
      green: "bg-emerald-100 dark:bg-emerald-900/40",
      amber: "bg-amber-100 dark:bg-amber-900/40",
      purple: "bg-purple-100 dark:bg-purple-900/40",
      rose: "bg-rose-100 dark:bg-rose-900/40",
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
          onPress={() => setShowBuilder(true)}
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
                const iconBgClasses = getIconBgClasses(report.color);
                const isHighlight = Boolean(report.highlight);

                return (
                  <Card
                    key={report.type}
                    isPressable
                    onPress={() => handleOpenRangeModal(report.type)}
                    className={`${bgClasses} border relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02]`}
                  >
                    {/* Gradiente decorativo */}
                    <div className="absolute top-0 right-0 w-32 h-32 opacity-10 dark:opacity-5 pointer-events-none">
                      <div className={`w-full h-full rounded-full blur-3xl ${iconBgClasses}`} />
                    </div>

                    {isHighlight && (
                      <div className="absolute top-2 right-2 z-10">
                        <Chip size="sm" variant="flat" color="warning" className="font-semibold">
                          Destaque
                        </Chip>
                      </div>
                    )}

                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3 w-full">
                        {/* Ícone com fundo */}
                        <div className={`p-2.5 rounded-lg ${iconBgClasses} transition-transform duration-300 group-hover:scale-110`}>
                          <Icon className={`h-5 w-5 ${textClasses}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className={`text-lg font-semibold ${textClasses} line-clamp-2`}>
                            {report.title}
                          </h3>
                        </div>
                      </div>
                    </CardHeader>

                    <CardBody className="pt-0">
                      <p className={`text-sm mb-4 ${textClasses} opacity-80 line-clamp-2`}>
                        {report.description}
                      </p>

                      {report.features && report.features.length > 0 && (
                        <div className="mb-4 space-y-1.5">
                          {report.features.map((feature) => (
                            <div key={feature} className="flex items-start gap-2 text-xs text-default-600 dark:text-default-400">
                              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${textClasses}`} />
                              <span className="flex-1">{feature}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        onPress={() => handleOpenRangeModal(report.type)}
                        size="sm"
                        className="w-full font-medium bg-black dark:bg-white text-white dark:text-black"
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
              <Card className="mt-6 bg-gradient-to-br from-default-50 to-default-100 dark:from-default-100/5 dark:to-default-50/5 border border-default-200 dark:border-default-800/40">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/40">
                      <FileTextIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Sobre os Relatórios Financeiros
                    </h3>
                  </div>
                </CardHeader>
                <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-background/50 dark:bg-background/20 border border-default-200 dark:border-default-700/30">
                    <h4 className="font-semibold text-sm mb-2 text-teal-700 dark:text-teal-300 flex items-center gap-2">
                      <TrendingUpIcon className="h-4 w-4" />
                      1. DRE Simplificada
                    </h4>
                    <p className="text-sm text-default-600 dark:text-default-400">
                      Mostra o lucro ou prejuízo do período através da fórmula:
                      Receita total – Despesas operacionais = Resultado líquido
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-background/50 dark:bg-background/20 border border-default-200 dark:border-default-700/30">
                    <h4 className="font-semibold text-sm mb-2 text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      2. Fluxo de Caixa
                    </h4>
                    <p className="text-sm text-default-600 dark:text-default-400">
                      Visualize entradas e saídas de dinheiro mês a mês para
                      prever necessidades de capital
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-background/50 dark:bg-background/20 border border-default-200 dark:border-default-700/30">
                    <h4 className="font-semibold text-sm mb-2 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <FileTextIcon className="h-4 w-4" />
                      3. Livro Caixa
                    </h4>
                    <p className="text-sm text-default-600 dark:text-default-400">
                      Registro completo de todas as movimentações financeiras,
                      ideal para controle diário e conciliação bancária
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-background/50 dark:bg-background/20 border border-default-200 dark:border-default-700/30">
                    <h4 className="font-semibold text-sm mb-2 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <DollarSignIcon className="h-4 w-4" />
                      4. Receitas por Cliente
                    </h4>
                    <p className="text-sm text-default-600 dark:text-default-400">
                      Identifique seus clientes mais rentáveis através da análise
                      de receita gerada por cada um
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-background/50 dark:bg-background/20 border border-default-200 dark:border-default-700/30">
                    <h4 className="font-semibold text-sm mb-2 text-amber-700 dark:text-amber-300 flex items-center gap-2">
                      <PieChartIcon className="h-4 w-4" />
                      5. Despesas por Categoria
                    </h4>
                    <p className="text-sm text-default-600 dark:text-default-400">
                      Controle de custos através da classificação de despesas em
                      grupos como folha, marketing, aluguel, etc.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-background/50 dark:bg-background/20 border border-default-200 dark:border-default-700/30">
                    <h4 className="font-semibold text-sm mb-2 text-purple-700 dark:text-purple-300 flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      6. Projeção de Fluxo de Caixa
                    </h4>
                    <p className="text-sm text-default-600 dark:text-default-400">
                      Planejamento financeiro através da previsão de entradas e
                      saídas futuras baseadas no histórico
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-background/50 dark:bg-background/20 border border-default-200 dark:border-default-700/30 md:col-span-2">
                    <h4 className="font-semibold text-sm mb-2 text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      7. Indicadores Financeiros (KPIs)
                    </h4>
                    <p className="text-sm text-default-600 dark:text-default-400">
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
              <SelectItem key={ReportFormat.PDF}>
                PDF
              </SelectItem>
              <SelectItem key={ReportFormat.CSV}>
                CSV
              </SelectItem>
              <SelectItem key={ReportFormat.XLS}>
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
                        <SelectItem key={client.id}>
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

