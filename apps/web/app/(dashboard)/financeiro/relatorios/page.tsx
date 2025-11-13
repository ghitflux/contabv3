"use client";

import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Spinner,
  Tabs,
  Tab,
} from "@/heroui";
import { useEffect, useState } from "react";
import { financeApi } from "@/lib/api/endpoints/finance";
import type {
  ReceivablesAgingReport,
  RevenueByPeriodReport,
} from "@/types/finance";
import { formatCurrency } from "@/types/finance";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState("aging");

  // Aging report state
  const [agingReport, setAgingReport] = useState<ReceivablesAgingReport | null>(null);

  // Revenue report state
  const [revenueReport, setRevenueReport] = useState<RevenueByPeriodReport | null>(null);
  const [startMonth, setStartMonth] = useState<string>("");
  const [endMonth, setEndMonth] = useState<string>("");

  useEffect(() => {
    // Set default months (last 6 months)
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), 1);
    const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    setStartMonth(start.toISOString().slice(0, 7));
    setEndMonth(end.toISOString().slice(0, 7));
  }, []);

  useEffect(() => {
    if (selectedTab === "aging") {
      loadAgingReport();
    }
  }, [selectedTab]);

  useEffect(() => {
    if (startMonth && endMonth && selectedTab === "revenue") {
      loadRevenueReport();
    }
  }, [startMonth, endMonth, selectedTab]);

  const loadAgingReport = async () => {
    try {
      setLoading(true);
      const data = await (financeApi as any).getReceivablesAging();
      setAgingReport(data);
    } catch (error) {
      console.error("Error loading aging report:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadRevenueReport = async () => {
    if (!startMonth || !endMonth) return;

    try {
      setLoading(true);
      const startDate = `${startMonth}-01`;
      const endDate = `${endMonth}-01`;
      const data = await (financeApi as any).getRevenueByPeriod(startDate, endDate);
      setRevenueReport(data);
    } catch (error) {
      console.error("Error loading revenue report:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPercentage = (amount: number, total: number) => {
    if (total === 0) return 0;
    return ((amount / total) * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Relatórios Financeiros</h1>
          <p className="text-default-500 mt-1">Análises e visões estratégicas</p>
        </div>
        <div className="flex gap-2">
          <Button color="primary" variant="flat">
            Exportar PDF
          </Button>
          <Button color="primary" variant="flat">
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) => setSelectedTab(key as string)}
        aria-label="Report tabs"
        color="primary"
      >
        <Tab key="aging" title="Aging de Recebíveis">
          {loading ? (
            <div className="flex justify-center items-center p-12">
              <Spinner size="lg" />
            </div>
          ) : agingReport ? (
            <div className="space-y-6 mt-6">
              {/* Summary */}
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">Resumo Geral</h3>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-default-500">Total a Receber</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(agingReport.total)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-default-500">Transações</p>
                      <p className="text-2xl font-bold">{agingReport.total_count}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-default-500">Ticket Médio</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(
                          agingReport.total_count > 0
                            ? agingReport.total / agingReport.total_count
                            : 0
                        )}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-default-500">% Atrasado</p>
                      <p className="text-2xl font-bold text-danger">
                        {getPercentage(
                          agingReport.days_0_30.total_amount +
                            agingReport.days_31_60.total_amount +
                            agingReport.days_61_90.total_amount +
                            agingReport.days_over_90.total_amount,
                          agingReport.total
                        )}
                        %
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Aging Buckets */}
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">Análise por Faixa</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    {/* Current */}
                    <div className="p-4 border border-divider rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h4 className="font-semibold text-success">
                            {agingReport.current.label}
                          </h4>
                          <p className="text-sm text-default-500">
                            {agingReport.current.count} transações
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-success">
                            {formatCurrency(agingReport.current.total_amount)}
                          </p>
                          <p className="text-sm text-default-500">
                            {getPercentage(
                              agingReport.current.total_amount,
                              agingReport.total
                            )}
                            % do total
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-default-200 rounded-full h-2">
                        <div
                          className="bg-success h-2 rounded-full"
                          style={{
                            width: `${getPercentage(
                              agingReport.current.total_amount,
                              agingReport.total
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* 0-30 days */}
                    <div className="p-4 border border-divider rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h4 className="font-semibold text-warning">
                            {agingReport.days_0_30.label}
                          </h4>
                          <p className="text-sm text-default-500">
                            {agingReport.days_0_30.count} transações
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-warning">
                            {formatCurrency(agingReport.days_0_30.total_amount)}
                          </p>
                          <p className="text-sm text-default-500">
                            {getPercentage(
                              agingReport.days_0_30.total_amount,
                              agingReport.total
                            )}
                            % do total
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-default-200 rounded-full h-2">
                        <div
                          className="bg-warning h-2 rounded-full"
                          style={{
                            width: `${getPercentage(
                              agingReport.days_0_30.total_amount,
                              agingReport.total
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* 31-60 days */}
                    <div className="p-4 border border-divider rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h4 className="font-semibold text-danger">
                            {agingReport.days_31_60.label}
                          </h4>
                          <p className="text-sm text-default-500">
                            {agingReport.days_31_60.count} transações
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-danger">
                            {formatCurrency(agingReport.days_31_60.total_amount)}
                          </p>
                          <p className="text-sm text-default-500">
                            {getPercentage(
                              agingReport.days_31_60.total_amount,
                              agingReport.total
                            )}
                            % do total
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-default-200 rounded-full h-2">
                        <div
                          className="bg-danger h-2 rounded-full"
                          style={{
                            width: `${getPercentage(
                              agingReport.days_31_60.total_amount,
                              agingReport.total
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* 61-90 days */}
                    <div className="p-4 border border-divider rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h4 className="font-semibold text-danger">
                            {agingReport.days_61_90.label}
                          </h4>
                          <p className="text-sm text-default-500">
                            {agingReport.days_61_90.count} transações
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-danger">
                            {formatCurrency(agingReport.days_61_90.total_amount)}
                          </p>
                          <p className="text-sm text-default-500">
                            {getPercentage(
                              agingReport.days_61_90.total_amount,
                              agingReport.total
                            )}
                            % do total
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-default-200 rounded-full h-2">
                        <div
                          className="bg-danger h-2 rounded-full"
                          style={{
                            width: `${getPercentage(
                              agingReport.days_61_90.total_amount,
                              agingReport.total
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Over 90 days */}
                    <div className="p-4 border border-divider rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h4 className="font-semibold text-danger">
                            {agingReport.days_over_90.label}
                          </h4>
                          <p className="text-sm text-default-500">
                            {agingReport.days_over_90.count} transações
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-danger">
                            {formatCurrency(agingReport.days_over_90.total_amount)}
                          </p>
                          <p className="text-sm text-default-500">
                            {getPercentage(
                              agingReport.days_over_90.total_amount,
                              agingReport.total
                            )}
                            % do total
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-default-200 rounded-full h-2">
                        <div
                          className="bg-danger h-2 rounded-full"
                          style={{
                            width: `${getPercentage(
                              agingReport.days_over_90.total_amount,
                              agingReport.total
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : null}
        </Tab>

        <Tab key="revenue" title="Receita por Período">
          <div className="space-y-6 mt-6">
            {/* Filters */}
            <Card>
              <CardBody>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <MonthYearPicker
                      label="Mês Inicial"
                      value={startMonth}
                      onChange={setStartMonth}
                    />
                  </div>
                  <div className="flex-1">
                    <MonthYearPicker
                      label="Mês Final"
                      value={endMonth}
                      onChange={setEndMonth}
                    />
                  </div>
                  <Button color="primary" onPress={loadRevenueReport}>
                    Atualizar
                  </Button>
                </div>
              </CardBody>
            </Card>

            {loading ? (
              <div className="flex justify-center items-center p-12">
                <Spinner size="lg" />
              </div>
            ) : revenueReport ? (
              <div className="space-y-6">
                {/* Summary */}
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold">Resumo do Período</h3>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-sm text-default-500">Receita Total</p>
                        <p className="text-3xl font-bold text-success">
                          {formatCurrency(revenueReport.total_receita)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-default-500">Despesa Total</p>
                        <p className="text-3xl font-bold text-danger">
                          {formatCurrency(revenueReport.total_despesa)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-default-500">Saldo</p>
                        <p className="text-3xl font-bold text-primary">
                          {formatCurrency(revenueReport.total_saldo)}
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Monthly breakdown */}
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold">Detalhamento Mensal</h3>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-3">
                      {revenueReport.periods.map((period) => (
                        <div
                          key={period.period}
                          className="p-4 border border-divider rounded-lg"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-semibold">
                                {new Date(period.period + "-01").toLocaleDateString(
                                  "pt-BR",
                                  {
                                    month: "long",
                                    year: "numeric",
                                  }
                                )}
                              </h4>
                            </div>
                            <div className="flex gap-6 text-right">
                              <div>
                                <p className="text-xs text-default-500">Receita</p>
                                <p className="font-semibold text-success">
                                  {formatCurrency(period.receita)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-default-500">Despesa</p>
                                <p className="font-semibold text-danger">
                                  {formatCurrency(period.despesa)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-default-500">Saldo</p>
                                <p className="font-bold text-primary">
                                  {formatCurrency(period.saldo)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              </div>
            ) : null}
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
