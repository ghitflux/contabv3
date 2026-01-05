"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Button,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from "@/heroui"
import type { Activity, ActivityCreate, ActivityUpdate } from "@/types/activity"
import { ActivityPriority, ActivityStatus } from "@/types/activity"
import { toast } from "@/lib/toast"

type AtividadesFormModalProps = {
  isOpen: boolean
  mode: "create" | "edit"
  isSubmitting?: boolean
  activity?: Activity | null
  defaultAssigneeId?: string
  defaultAssigneeName?: string | null
  onClose: () => void
  onSubmit: (payload: ActivityCreate | ActivityUpdate) => Promise<void>
}

type ActivityFormState = {
  title: string
  description: string
  status: ActivityStatus | string
  priority: ActivityPriority | string
  assigned_to_id: string
  due_date: string
  reminders: boolean
  labelsInput: string
}

const statusOptions = [
  { key: ActivityStatus.TODO, label: "A Fazer" },
  { key: ActivityStatus.IN_PROGRESS, label: "Em Andamento" },
  { key: ActivityStatus.REVIEW, label: "Revisão" },
  { key: ActivityStatus.DONE, label: "Concluído" },
]

const priorityOptions = [
  { key: ActivityPriority.LOW, label: "Baixa" },
  { key: ActivityPriority.MEDIUM, label: "Média" },
  { key: ActivityPriority.HIGH, label: "Alta" },
]

const buildInitialState = (
  _mode: "create" | "edit",
  activity?: Activity | null,
  defaultAssigneeId?: string,
): ActivityFormState => ({
  title: activity?.title ?? "",
  description: activity?.description ?? "",
  status: activity?.status ?? ActivityStatus.TODO,
  priority: activity?.priority ?? ActivityPriority.MEDIUM,
  assigned_to_id: activity?.assigned_to_id ?? defaultAssigneeId ?? "",
  due_date: activity?.due_date ?? "",
  reminders: activity?.reminders ?? false,
  labelsInput: activity?.labels?.join(", ") ?? "",
})

const parseLabels = (input: string) =>
  input
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean)

export function AtividadesFormModal({
  isOpen,
  mode,
  isSubmitting = false,
  activity,
  defaultAssigneeId,
  defaultAssigneeName,
  onClose,
  onSubmit,
}: AtividadesFormModalProps) {
  const [formState, setFormState] = useState<ActivityFormState>(() =>
    buildInitialState(mode, activity, defaultAssigneeId),
  )

  useEffect(() => {
    if (!isOpen) return
    setFormState(buildInitialState(mode, activity, defaultAssigneeId))
  }, [isOpen, mode, activity, defaultAssigneeId])

  const isAssigneeLocked = Boolean(defaultAssigneeId) && mode === "create"

  const assigneeDescription = useMemo(() => {
    if (isAssigneeLocked) return "Responsável padrão: você."
    if (defaultAssigneeName) return `Responsável padrão sugerido: ${defaultAssigneeName}.`
    return "Informe o ID do usuário responsável."
  }, [defaultAssigneeName, isAssigneeLocked])

  const handleSubmit = async () => {
    const title = formState.title.trim()
    const assignedToId = formState.assigned_to_id || defaultAssigneeId || ""

    if (!assignedToId) {
      toast.error("Informe o responsável da atividade.")
      return
    }
    if (!title) {
      toast.error("Informe o título da atividade.")
      return
    }

    const payload = {
      title,
      description: formState.description.trim() || null,
      status: formState.status || ActivityStatus.TODO,
      priority: formState.priority || ActivityPriority.MEDIUM,
      assigned_to_id: assignedToId,
      due_date: formState.due_date || null,
      labels: parseLabels(formState.labelsInput),
      reminders: formState.reminders,
    } satisfies ActivityCreate

    await onSubmit(payload)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        {() => (
          <>
            <ModalHeader>
              {mode === "create" ? "Criar Nova Atividade" : "Editar Atividade"}
            </ModalHeader>
            <ModalBody className="space-y-4">
              <Input
                label="Título *"
                placeholder="Nome da atividade"
                value={formState.title}
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, title: value }))
                }
              />
              <Textarea
                label="Descrição"
                placeholder="Descreva a atividade..."
                value={formState.description}
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, description: value }))
                }
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Status"
                  selectedKeys={formState.status ? [formState.status] : []}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as ActivityStatus | undefined
                    if (value) {
                      setFormState((prev) => ({ ...prev, status: value }))
                    }
                  }}
                >
                  {statusOptions.map((status) => (
                    <SelectItem key={status.key}>{status.label}</SelectItem>
                  ))}
                </Select>
                <Select
                  label="Prioridade"
                  selectedKeys={formState.priority ? [formState.priority] : []}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as ActivityPriority | undefined
                    if (value) {
                      setFormState((prev) => ({ ...prev, priority: value }))
                    }
                  }}
                >
                  {priorityOptions.map((priority) => (
                    <SelectItem key={priority.key}>{priority.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Responsável"
                  placeholder="ID do responsável"
                  isDisabled={isAssigneeLocked}
                  value={formState.assigned_to_id || defaultAssigneeName || defaultAssigneeId || ""}
                  description={assigneeDescription}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, assigned_to_id: value }))
                  }
                />
                <Input
                  label="Data de Vencimento"
                  type="date"
                  value={formState.due_date}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, due_date: value }))
                  }
                />
              </div>
              <Input
                label="Etiquetas"
                placeholder="Fiscal, Urgente, Cliente"
                value={formState.labelsInput}
                description="Separe as etiquetas por vírgula."
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, labelsInput: value }))
                }
              />
              <Checkbox
                isSelected={formState.reminders}
                onValueChange={(checked) =>
                  setFormState((prev) => ({ ...prev, reminders: checked }))
                }
              >
                Ativar lembretes
              </Checkbox>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancelar
              </Button>
              <Button
                color="primary"
                onPress={handleSubmit}
                isLoading={isSubmitting}
              >
                {mode === "create" ? "Criar Atividade" : "Salvar Alterações"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
