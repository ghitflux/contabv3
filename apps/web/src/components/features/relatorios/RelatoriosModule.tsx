"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button, Card, CardBody, CardHeader, Tabs, Tab } from "@/heroui";
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
import { SavedReports } from "./SavedReports";

const financialReports = [
  {
    id: "dre",
    title: "DRE Simplificada",
    description: "Demonstrativo de Resultados - Receita total menos Despesas operacionais",
    icon: TrendingUpIcon,
    color: "teal",
  },
  {
    id: "fluxo-caixa",
    title: "Fluxo de Caixa",
    description: "Entradas e saídas de dinheiro mês a mês",
    icon: Activity,
    color: "blue",
  },
  {
    id: "livro-caixa",
    title: "Livro Caixa",
    description: "Todas as movimentações financeiras - receitas, despesas e saldo",
    icon: FileTextIcon,
    color: "slate",
  },
  {
    id: "receitas-cliente",
    title: "Receitas por Cliente",
    description: "Quanto cada cliente gerou em receita no período",
    icon: DollarSignIcon,
    color: "green",
  },
  {
    id: "despesas-categoria",
    title: "Despesas por Categoria",
    description: "Despesas classificadas em grupos (folha, marketing, aluguel, etc.)",
    icon: PieChartIcon,
    color: "amber",
  },
  {
    id: "projecao-fluxo",
    title: "Projeção de Fluxo de Caixa",
    description: "Previsão de entradas e saídas futuras com base no histórico",
    icon: CalendarIcon,
    color: "purple",
  },
  {
    id: "kpis",
    title: "Indicadores Financeiros (KPIs)",
    description: "Margem de lucro, despesas fixas, índice de inadimplência",
    icon: Target,
    color: "rose",
  },
];

export function RelatoriosModule() {
  const [activeTab, setActiveTab] = useState("essenciais");
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const handleGenerateReport = (reportId: string) => {
    setSelectedReport(reportId);
    // Aqui seria implementada a lógica de geração do relatório
    console.log(`Gerando relatório: ${reportId}`);
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

                return (
                  <Card key={report.id} className={`${bgClasses} border`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-5 w-5 ${textClasses}`} />
                            <h3 className={`text-lg font-semibold ${textClasses}`}>
                              {report.title}
                            </h3>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardBody>
                      <p className={`text-sm mb-4 opacity-90 ${textClasses}`}>
                        {report.description}
                      </p>
                      <Button
                        onClick={() => handleGenerateReport(report.id)}
                        variant="bordered"
                        size="sm"
                        className="w-full"
                      >
                        Gerar Relatório
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
            key="saved"
            title={
              <div className="flex items-center gap-2">
                <FileTextIcon className="h-4 w-4" />
                Relatórios Salvos
              </div>
            }
          >
            <motion.div
              key="saved"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={fadeIn}
              className="mt-6"
            >
              <SavedReports onEdit={() => setShowBuilder(true)} />
            </motion.div>
          </Tab>
        </Tabs>
      )}
    </motion.div>
  );
}

