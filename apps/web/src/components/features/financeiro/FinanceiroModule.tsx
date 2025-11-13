"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Tabs, Tab } from "@/heroui";
import { FinanceiroEscritorio } from "./FinanceiroEscritorio";
import { FinanceiroPorEmpresa } from "./FinanceiroPorEmpresa";
import { FinanceiroLancamentos } from "./FinanceiroLancamentos";
import { pageTransition, fadeIn } from "@/lib/animations";

export function FinanceiroModule() {
  const [activeTab, setActiveTab] = useState("escritorio");

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-foreground">Painel Financeiro — Livro-Caixa</h1>
        <p className="text-default-500 mt-1">Gestão completa de receitas, despesas e análises financeiras</p>
      </div>

      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        color="primary"
      >
        <Tab key="escritorio" title="Escritório">
          <motion.div
            key="escritorio"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={fadeIn}
            className="mt-6"
          >
            <FinanceiroEscritorio />
          </motion.div>
        </Tab>
        <Tab key="por-empresa" title="Por Empresa">
          <motion.div
            key="por-empresa"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={fadeIn}
            className="mt-6"
          >
            <FinanceiroPorEmpresa />
          </motion.div>
        </Tab>
        <Tab key="lancamentos" title="Lançamentos">
          <motion.div
            key="lancamentos"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={fadeIn}
            className="mt-6"
          >
            <FinanceiroLancamentos />
          </motion.div>
        </Tab>
      </Tabs>
    </motion.div>
  );
}

