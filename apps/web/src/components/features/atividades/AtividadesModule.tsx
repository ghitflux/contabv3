"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Tabs, Tab } from "@/heroui"
import { AtividadesKanban } from "./AtividadesKanban"
import { AtividadesCalendar } from "./AtividadesCalendar"
import { AtividadesLista } from "./AtividadesLista"
import { pageTransition, fadeIn } from "@/lib/animations"

export function AtividadesModule() {
  const [activeTab, setActiveTab] = useState("kanban")

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-foreground">Atividades</h1>
        <p className="text-default-500 mt-1">Gestão de tarefas e atividades</p>
      </div>

      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        color="primary"
      >
        <Tab key="kanban" title="Kanban">
          <motion.div
            key="kanban"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={fadeIn}
            className="mt-6"
          >
            <AtividadesKanban />
          </motion.div>
        </Tab>
        <Tab key="calendar" title="Calendário">
          <motion.div
            key="calendar"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={fadeIn}
            className="mt-6"
          >
            <AtividadesCalendar />
          </motion.div>
        </Tab>
        <Tab key="lista" title="Lista">
          <motion.div
            key="lista"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={fadeIn}
            className="mt-6"
          >
            <AtividadesLista />
          </motion.div>
        </Tab>
      </Tabs>
    </motion.div>
  )
}

