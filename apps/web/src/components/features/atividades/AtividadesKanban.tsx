"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Badge,
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
import { Plus, Calendar, User, Tag } from "lucide-react"
import { mockActivities, type Activity } from "@/lib/mocks/activities"
import { staggerContainer, staggerItem, cardHover } from "@/lib/animations"

export function AtividadesKanban() {
  const [activities, setActivities] = useState<Activity[]>(mockActivities)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newActivity, setNewActivity] = useState<Partial<Activity>>({
    status: "todo",
    priority: "medium",
    labels: [],
    reminders: false,
  })

  const columns = [
    { id: "todo", title: "A Fazer", color: "bg-default-100" },
    { id: "in-progress", title: "Em Andamento", color: "bg-primary-50 dark:bg-primary-950/20" },
    { id: "review", title: "Revisão", color: "bg-warning-50 dark:bg-warning-950/20" },
    { id: "done", title: "Concluído", color: "bg-success-50 dark:bg-success-950/20" },
  ]

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400"
      case "medium":
        return "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400"
      case "low":
        return "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400"
      default:
        return "bg-default-100 text-default-700"
    }
  }

  const handleCreateActivity = () => {
    const activity: Activity = {
      id: String(activities.length + 1),
      title: newActivity.title || "",
      description: newActivity.description || "",
      status: newActivity.status as Activity["status"],
      priority: newActivity.priority as Activity["priority"],
      assignedTo: newActivity.assignedTo || "",
      dueDate: newActivity.dueDate || "",
      labels: newActivity.labels || [],
      recurrence: newActivity.recurrence,
      reminders: newActivity.reminders || false,
    }

    setActivities([...activities, activity])
    setIsDialogOpen(false)
    setNewActivity({ status: "todo", priority: "medium", labels: [], reminders: false })
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          color="primary"
          startContent={<Plus className="h-4 w-4" />}
          onPress={() => setIsDialogOpen(true)}
        >
          Nova Atividade
        </Button>
      </div>

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
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <h3 className="text-base font-semibold">{column.title}</h3>
                    <Badge variant="flat" color="default">
                      {columnActivities.length}
                    </Badge>
                  </div>
                </CardHeader>
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
                            <Badge
                              className={getPriorityColor(activity.priority)}
                              variant="flat"
                              size="sm"
                            >
                              {activity.priority === "high"
                                ? "Alta"
                                : activity.priority === "medium"
                                  ? "Média"
                                  : "Baixa"}
                            </Badge>
                          </div>
                          {activity.description && (
                            <p className="text-xs text-default-500 line-clamp-2">
                              {activity.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {activity.labels.map((label) => (
                              <Badge key={label} variant="flat" size="sm" className="text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {label}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-xs text-default-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(activity.dueDate)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span className="truncate max-w-[100px]">{activity.assignedTo}</span>
                            </div>
                          </div>
                          {activity.recurrence && (
                            <Badge variant="flat" size="sm" className="text-xs">
                              Recorrente:{" "}
                              {activity.recurrence === "daily"
                                ? "Diária"
                                : activity.recurrence === "weekly"
                                  ? "Semanal"
                                  : "Mensal"}
                            </Badge>
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
                      const value = Array.from(keys)[0] as Activity["priority"] | undefined
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
                    placeholder="Nome do responsável"
                    value={newActivity.assignedTo || ""}
                    onValueChange={(value) =>
                      setNewActivity({ ...newActivity, assignedTo: value })
                    }
                  />
                </div>
                <Input
                  label="Data de Vencimento"
                  type="date"
                  value={newActivity.dueDate || ""}
                  onValueChange={(value) => setNewActivity({ ...newActivity, dueDate: value })}
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
                <Button color="primary" onPress={handleCreateActivity}>
                  Criar Atividade
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

