"use client";

import { useState } from "react";
import { Tabs, Tab } from "@/heroui";
import { FinanceiroEscritorio } from "./FinanceiroEscritorio";
import { FinanceiroPorEmpresa } from "./FinanceiroPorEmpresa";
import { FinanceiroLancamentos } from "./FinanceiroLancamentos";

export function FinanceiroModule() {
  const [activeTab, setActiveTab] = useState("escritorio");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Painel Financeiro — Livro-Caixa</h1>
        <p className="text-default-500 mt-1">Gestão completa de receitas, despesas e análises financeiras</p>
      </div>

      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        color="primary"
        variant="underlined"
      >
        <Tab key="escritorio" title="Escritório">
          <div className="mt-6">
            <FinanceiroEscritorio />
          </div>
        </Tab>
        <Tab key="por-empresa" title="Por Empresa">
          <div className="mt-6">
            <FinanceiroPorEmpresa />
          </div>
        </Tab>
        <Tab key="lancamentos" title="Lançamentos">
          <div className="mt-6">
            <FinanceiroLancamentos />
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}

