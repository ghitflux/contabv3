"use client"

import { useState, forwardRef, useImperativeHandle } from "react"
import { motion } from "framer-motion"
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Select,
  SelectItem,
  Checkbox,
} from "@/heroui"
import { Plus, Calendar, User } from "lucide-react"
import { staggerContainer, staggerItem, cardHover } from "@/lib/animations"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { LabelChip } from "@/components/ui/LabelChip"
import type { Activity, ActivityCreate } from "@/types/activity"
import { ActivityPriority, ActivityStatus } from "@/types/activity"
import { toast } from "@/lib/toast"

export const AtividadesKanban = forwardRef<
  { openModal: () => void },
  {
    activities: Activity[]
    isLoading?: boolean
    onCreate: (payload: ActivityCreate) => Promise<void>
    defaultAssigneeId?: string
    defaultAssigneeName?: string | null
  }
>(({ activities, isLoading, onCreate, defaultAssigneeId, defaultAssigneeName }, ref) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useImperativeHandle(ref, () => ({
    openModal: () => setIsDialogOpen(true),
  }))
  const [newActivity, setNewActivity] = useState<Partial<ActivityCreate>>({
    status: ActivityStatus.TODO,
    priority: ActivityPriority.MEDIUM,
    labels: [],
    reminders: false,
    assigned_to_id: defaultAssigneeId,
  })

  const columns = [
    {
      id: "todo",
      title: "A Fazer",
      color: "bg-default-100/80 dark:bg-default-100/5"
    },
    {
      id: "in-progress",
      title: "Em Andamento",
      color: "bg-primary-100/60 dark:bg-primary-900/20"
    },
    {
      id: "review",
      title: "Revisão",
      color: "bg-warning-100/60 dark:bg-warning-900/20"
    },
    {
      id: "done",
      title: "Concluído",
      color: "bg-success-100/60 dark:bg-success-900/20"
    },
  ]

  const getPriorityColor = (priority: string | ActivityPriority) => {
    switch (priority) {
      case ActivityPriority.HIGH:
        return "bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400"
      case ActivityPriority.MEDIUM:
        return "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400"
      case ActivityPriority.LOW:
        return "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400"
      default:
        return "bg-default-100 text-default-700"
    }
  }

  const handleCreateActivity = async () => {
    const assignedToId = newActivity.assigned_to_id || defaultAssigneeId || ""
    if (!assignedToId) {
      toast.error("Informe o responsável da atividade.")
      return
    }
    if (!newActivity.title?.trim()) {
      toast.error("Informe o título da atividade.")
      return
    }

    const payload: ActivityCreate = {
      title: newActivity.title.trim(),
      description: newActivity.description?.trim() || null,
      status: (newActivity.status as ActivityStatus | string) || ActivityStatus.TODO,
      priority: (newActivity.priority as ActivityPriority | string) || ActivityPriority.MEDIUM,
      assigned_to_id: assignedToId,
      due_date: newActivity.due_date || null,
      labels: newActivity.labels || [],
      recurrence: (newActivity.recurrence as any) || null,
      reminders: Boolean(newActivity.reminders),
    }

    try {
      setIsSubmitting(true)
      await onCreate(payload)
      setIsDialogOpen(false)
      setNewActivity({
        status: ActivityStatus.TODO,
        priority: ActivityPriority.MEDIUM,
        labels: [],
        reminders: false,
        assigned_to_id: defaultAssigneeId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível criar a atividade."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  }

  return (
    <div className="space-y-4">

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {columns.map((column) => {
          const columnActivities = activities.filter((a) => a.status === column.id)
          return (
            <motion.div key={column.id} variants={staggerItem}>
              <Card className={column.color}>
                <div className="px-3 pt-3 pb-0">
                  <div className="flex items-center justify-between w-full">
                    <h3 className="text-base font-semibold">{column.title}</h3>
                    <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-default-100 dark:bg-default-100/20 text-default-700 dark:text-default-400 text-xs font-medium">
                      {isLoading ? "..." : columnActivities.length}
                    </span>
                  </div>
                </div>
                <CardBody className="space-y-3">
                  {columnActivities.map((activity) => (
                    <motion.div
                      key={activity.id}
                      variants={cardHover}
                      initial="rest"
                      whileHover="hover"
                      whileTap="tap"
                    >
                      <Card className="bg-background cursor-pointer">
                        <CardBody className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm leading-tight">{activity.title}</h4>
                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getPriorityColor(activity.priority)}`}>
                              {activity.priority === ActivityPriority.HIGH
                                ? "Alta"
                                : activity.priority === ActivityPriority.MEDIUM
                                  ? "Média"
                                  : "Baixa"}
                            </span>
                          </div>
                          {activity.description && (
                            <p className="text-xs text-default-500 line-clamp-2">
                              {activity.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {activity.labels.map((label) => (
                              <LabelChip key={label} label={label} size="sm" />
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-xs text-default-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(activity.due_date)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span className="truncate max-w-[140px]">
                                {activity.assigned_to_name || activity.assigned_to_id || "-"}
                              </span>
                            </div>
                          </div>
                          {activity.recurrence && (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-default-100 dark:bg-default-100/20 text-default-700 dark:text-default-400">
                              Recorrente:{" "}
                              {activity.recurrence === "daily"
                                ? "Diária"
                                : activity.recurrence === "weekly"
                                  ? "Semanal"
                                  : "Mensal"}
                            </span>
                          )}
                        </CardBody>
                      </Card>
                    </motion.div>
                  ))}
                  {columnActivities.length === 0 && (
                    <div className="text-center py-8 text-sm text-default-400">
                      Nenhuma atividade
                    </div>
                  )}
                </CardBody>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>

      <Modal isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Criar Nova Atividade</ModalHeader>
              <ModalBody className="space-y-4">
                <Input
                  label="Título *"
                  placeholder="Nome da atividade"
                  value={newActivity.title || ""}
                  onValueChange={(value) => setNewActivity({ ...newActivity, title: value })}
                />
                <Textarea
                  label="Descrição"
                  placeholder="Descreva a atividade..."
                  value={newActivity.description || ""}
                  onValueChange={(value) =>
                    setNewActivity({ ...newActivity, description: value })
                  }
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Prioridade"
                    selectedKeys={newActivity.priority ? [newActivity.priority] : []}
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as ActivityPriority | undefined
                      if (value) {
                        setNewActivity({ ...newActivity, priority: value })
                      }
                    }}
                  >
                    <SelectItem key="low">Baixa</SelectItem>
                    <SelectItem key="medium">Média</SelectItem>
                    <SelectItem key="high">Alta</SelectItem>
                  </Select>
                  <Input
                    label="Responsável"
                    placeholder="ID do responsável"
                    isDisabled={Boolean(defaultAssigneeId)}
                    value={
                      newActivity.assigned_to_id ||
                      defaultAssigneeName ||
                      defaultAssigneeId ||
                      ""
                    }
                    description={
                      defaultAssigneeId
                        ? "Responsável padrão: você."
                        : "Informe o ID do usuário responsável."
                    }
                    onValueChange={(value) => setNewActivity({ ...newActivity, assigned_to_id: value })}
                  />
                </div>
                <Input
                  label="Data de Vencimento"
                  type="date"
                  value={newActivity.due_date || ""}
                  onValueChange={(value) => setNewActivity({ ...newActivity, due_date: value })}
                />
                <Checkbox
                  isSelected={newActivity.reminders}
                  onValueChange={(checked) =>
                    setNewActivity({ ...newActivity, reminders: checked })
                  }
                >
                  Ativar lembretes
                </Checkbox>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="primary" onPress={handleCreateActivity} isLoading={isSubmitting}>
                  Criar Atividade
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
})

AtividadesKanban.displayName = "AtividadesKanban"
