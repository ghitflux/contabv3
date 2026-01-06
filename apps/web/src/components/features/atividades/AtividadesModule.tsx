"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Button, Card, CardBody, Input, Select, SelectItem, Tab, Tabs } from "@/heroui"
import {
  AlertTriangle,
  CalendarDays,
  LayoutGrid,
  ListChecks,
  Plus,
  Search,
} from "lucide-react"
import { AtividadesKanban } from "./AtividadesKanban"
import { AtividadesCalendar } from "./AtividadesCalendar"
import { AtividadesLista } from "./AtividadesLista"
import { AtividadesFormModal } from "./AtividadesFormModal"
import { pageTransition, fadeIn } from "@/lib/animations"
import { useActivities } from "@/hooks/useActivities"
import type { Activity, ActivityCreate, ActivityUpdate } from "@/types/activity"
import { ActivityPriority, ActivityStatus } from "@/types/activity"
import { useAuth } from "@/hooks/auth/AuthContext"
import { toast } from "@/lib/toast"

const DEFAULT_PAGE_SIZE = 200

export function AtividadesModule() {
  const [activeTab, setActiveTab] = useState("kanban")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterPriority, setFilterPriority] = useState("all")
  const { activities, isLoading, createActivity, updateActivity, fetchActivities } =
    useActivities()
  const { user } = useAuth()

  useEffect(() => {
    fetchActivities({ page: 1, size: DEFAULT_PAGE_SIZE })
  }, [fetchActivities])

  const activityItems = activities?.items ?? []

  const filteredActivities = useMemo(() => {
    return activityItems.filter((activity) => {
      const matchSearch =
        searchTerm === "" ||
        activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (activity.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (activity.assigned_to_name || activity.assigned_to_id || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())

      const matchStatus = filterStatus === "all" || activity.status === filterStatus
      const matchPriority = filterPriority === "all" || activity.priority === filterPriority

      return matchSearch && matchStatus && matchPriority
    })
  }, [activityItems, searchTerm, filterStatus, filterPriority])

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0]
    if (!todayStr) return { total: 0, open: 0, dueToday: 0, overdue: 0 }

    let open = 0
    let dueToday = 0
    let overdue = 0

    activityItems.forEach((activity) => {
      const isDone = activity.status === ActivityStatus.DONE
      if (!isDone) open += 1
      if (activity.due_date) {
        if (activity.due_date === todayStr) dueToday += 1
        if (!isDone && activity.due_date < todayStr) overdue += 1
      }
    })

    return {
      total: activityItems.length,
      open,
      dueToday,
      overdue,
    }
  }, [activityItems])

  const hasFilters =
    searchTerm.trim().length > 0 || filterStatus !== "all" || filterPriority !== "all"

  const openCreateModal = () => {
    setFormMode("create")
    setEditingActivity(null)
    setIsFormOpen(true)
  }

  const openEditModal = (activity: Activity) => {
    setFormMode("edit")
    setEditingActivity(activity)
    setIsFormOpen(true)
  }

  const closeFormModal = () => {
    if (isSubmitting) return
    setIsFormOpen(false)
  }

  const handleCreateActivity = async (payload: ActivityCreate | ActivityUpdate) => {
    try {
      setIsSubmitting(true)
      await createActivity({
        ...payload,
        status: payload.status ?? ActivityStatus.TODO,
        priority: payload.priority ?? ActivityPriority.MEDIUM,
        assigned_to_id: payload.assigned_to_id || user?.id || "",
      } as ActivityCreate)
      toast.success("Atividade criada com sucesso.")
      setIsFormOpen(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível criar a atividade."
      toast.error(message)
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateActivity = async (payload: ActivityCreate | ActivityUpdate) => {
    if (!editingActivity) return
    try {
      setIsSubmitting(true)
      await updateActivity(editingActivity.id, payload as ActivityUpdate)
      toast.success("Atividade atualizada com sucesso.")
      setIsFormOpen(false)
      setEditingActivity(null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível atualizar a atividade."
      toast.error(message)
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMoveActivity = async (activityId: string, status: ActivityStatus) => {
    try {
      await updateActivity(activityId, { status })
      toast.success("Status atualizado.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível mover a atividade."
      toast.error(message)
      throw error
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageTransition}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Atividades</h1>
          <p className="text-default-500 mt-1">Gestão de tarefas e atividades</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            color="primary"
            startContent={<Plus className="h-4 w-4" />}
            onPress={openCreateModal}
          >
            Nova Atividade
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-l-4 border-blue-500">
          <CardBody className="p-4 space-y-2">
            <p className="text-xs uppercase text-default-600 font-medium">Total</p>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-blue-500/10">
                <ListChecks className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</p>
            </div>
          </CardBody>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border-l-4 border-purple-500">
          <CardBody className="p-4 space-y-2">
            <p className="text-xs uppercase text-default-600 font-medium">Em Aberto</p>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-purple-500/10">
                <LayoutGrid className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.open}</p>
            </div>
          </CardBody>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500">
          <CardBody className="p-4 space-y-2">
            <p className="text-xs uppercase text-default-600 font-medium">Para Hoje</p>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-500/10">
                <CalendarDays className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.dueToday}</p>
            </div>
          </CardBody>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border-l-4 border-red-500">
          <CardBody className="p-4 space-y-2">
            <p className="text-xs uppercase text-default-600 font-medium">Atrasadas</p>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              placeholder="Buscar atividades..."
              value={searchTerm}
              onValueChange={setSearchTerm}
              startContent={<Search className="h-4 w-4 text-default-400" />}
              size="sm"
              className="flex-1"
            />
            <Select
              label="Status"
              selectedKeys={filterStatus === "all" ? [] : [filterStatus]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string | undefined
                setFilterStatus(value || "all")
              }}
              size="sm"
              className="w-full lg:w-[200px]"
            >
              <SelectItem key="all">Todos os status</SelectItem>
              <SelectItem key="todo">A Fazer</SelectItem>
              <SelectItem key="in-progress">Em Andamento</SelectItem>
              <SelectItem key="review">Revisão</SelectItem>
              <SelectItem key="done">Concluído</SelectItem>
            </Select>
            <Select
              label="Prioridade"
              selectedKeys={filterPriority === "all" ? [] : [filterPriority]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string | undefined
                setFilterPriority(value || "all")
              }}
              size="sm"
              className="w-full lg:w-[200px]"
            >
              <SelectItem key="all">Todas</SelectItem>
              <SelectItem key="high">Alta</SelectItem>
              <SelectItem key="medium">Média</SelectItem>
              <SelectItem key="low">Baixa</SelectItem>
            </Select>
            <Button
              variant="bordered"
              size="sm"
              onPress={() => {
                setSearchTerm("")
                setFilterStatus("all")
                setFilterPriority("all")
              }}
              isDisabled={!hasFilters}
            >
              Limpar filtros
            </Button>
          </div>
          <div className="text-sm text-default-500">
            Exibindo {filteredActivities.length} de {activityItems.length} atividades
          </div>
        </CardBody>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}
            color="primary"
          >
            <Tab
              key="kanban"
              title={
                <span className="inline-flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Kanban
                </span>
              }
            />
            <Tab
              key="calendar"
              title={
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Calendário
                </span>
              }
            />
            <Tab
              key="lista"
              title={
                <span className="inline-flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Lista
                </span>
              }
            />
          </Tabs>
          {activeTab === "kanban" && (
            <p className="text-sm text-default-500">
              Arraste e solte os cards para mover entre etapas.
            </p>
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
                activities={filteredActivities}
                isLoading={isLoading}
                onMove={handleMoveActivity}
                onSelectActivity={openEditModal}
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
              <AtividadesCalendar
                activities={filteredActivities}
                isLoading={isLoading}
                onSelectActivity={openEditModal}
              />
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
              <AtividadesLista
                activities={filteredActivities}
                isLoading={isLoading}
                onSelectActivity={openEditModal}
              />
            </motion.div>
          )}
        </div>
      </div>

      <AtividadesFormModal
        isOpen={isFormOpen}
        mode={formMode}
        activity={editingActivity}
        defaultAssigneeId={user?.id ?? undefined}
        defaultAssigneeName={user?.name ?? null}
        isSubmitting={isSubmitting}
        onClose={closeFormModal}
        onSubmit={formMode === "create" ? handleCreateActivity : handleUpdateActivity}
      />
    </motion.div>
  )
}
