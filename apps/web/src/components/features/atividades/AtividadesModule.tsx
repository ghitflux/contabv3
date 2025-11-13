"use client"

import { useState, useRef } from "react"
import { motion } from "framer-motion"
import { Tabs, Tab, Button } from "@/heroui"
import { Plus } from "lucide-react"
import { AtividadesKanban } from "./AtividadesKanban"
import { AtividadesCalendar } from "./AtividadesCalendar"
import { AtividadesLista } from "./AtividadesLista"
import { pageTransition, fadeIn } from "@/lib/animations"

export function AtividadesModule() {
  const [activeTab, setActiveTab] = useState("kanban")
  const kanbanRef = useRef<{ openModal: () => void }>(null)

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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}
            color="primary"
          >
            <Tab key="kanban" title="Kanban" />
            <Tab key="calendar" title="Calendário" />
            <Tab key="lista" title="Lista" />
          </Tabs>
          {activeTab === "kanban" && (
            <Button
              color="primary"
              startContent={<Plus className="h-4 w-4" />}
              onPress={() => {
                kanbanRef.current?.openModal()
              }}
            >
              Nova Atividade
            </Button>
          )}
        </div>

        <div className="mt-6">
          {activeTab === "kanban" && (
            <motion.div
              key="kanban"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={fadeIn}
            >
              <AtividadesKanban ref={kanbanRef} />
            </motion.div>
          )}
          {activeTab === "calendar" && (
            <motion.div
              key="calendar"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={fadeIn}
            >
              <AtividadesCalendar />
            </motion.div>
          )}
          {activeTab === "lista" && (
            <motion.div
              key="lista"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={fadeIn}
            >
              <AtividadesLista />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

