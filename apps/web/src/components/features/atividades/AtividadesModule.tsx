"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Tabs, Tab, Button } from "@/heroui"
import { Plus } from "lucide-react"
import { AtividadesKanban } from "./AtividadesKanban"
import { AtividadesCalendar } from "./AtividadesCalendar"
import { AtividadesLista } from "./AtividadesLista"
import { pageTransition, fadeIn } from "@/lib/animations"
import { useActivities } from "@/hooks/useActivities"
import type { ActivityCreate } from "@/types/activity"
import { ActivityStatus, ActivityPriority } from "@/types/activity"
import { useAuth } from "@/hooks/auth/AuthContext"
import { toast } from "@/lib/toast"

export function AtividadesModule() {
  const [activeTab, setActiveTab] = useState("kanban")
  const kanbanRef = useRef<{ openModal: () => void }>(null)
  const { activities, isLoading, createActivity, fetchActivities } = useActivities()
  const { user } = useAuth()

  useEffect(() => {
    fetchActivities({ page: 1, size: 200 })
  }, [fetchActivities])

  const handleCreateActivity = async (payload: ActivityCreate) => {
    try {
      await createActivity({
        ...payload,
        status: payload.status ?? ActivityStatus.TODO,
        priority: payload.priority ?? ActivityPriority.MEDIUM,
        assigned_to_id: payload.assigned_to_id || user?.id || "",
      })
      toast.success("Atividade criada com sucesso.")
      // Refresh list to ensure consistency with server pagination
      fetchActivities({ page: 1, size: 200 })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível criar a atividade."
      toast.error(message)
      throw error
    }
  }

  const activityItems = activities?.items ?? []

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
              <AtividadesKanban
                ref={kanbanRef}
                activities={activityItems}
                isLoading={isLoading}
                onCreate={handleCreateActivity}
                defaultAssigneeId={user?.id ?? undefined}
                defaultAssigneeName={user?.name ?? null}
              />
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
              <AtividadesCalendar activities={activityItems} isLoading={isLoading} />
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
              <AtividadesLista activities={activityItems} isLoading={isLoading} />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
