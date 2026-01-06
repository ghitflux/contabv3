"use client"

import { motion } from "framer-motion"
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/heroui"
import { Calendar, Pencil, User } from "lucide-react"
import { fadeIn } from "@/lib/animations"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { LabelChip } from "@/components/ui/LabelChip"
import type { Activity } from "@/types/activity"
import { ActivityPriority, ActivityStatus } from "@/types/activity"

type AtividadesListaProps = {
  activities: Activity[]
  isLoading?: boolean
  onSelectActivity?: (activity: Activity) => void
}

export function AtividadesLista({
  activities,
  isLoading = false,
  onSelectActivity,
}: AtividadesListaProps) {
  const getPriorityLabel = (priority: string | ActivityPriority) => {
    switch (priority) {
      case ActivityPriority.HIGH:
        return "Alta"
      case ActivityPriority.MEDIUM:
        return "Média"
      case ActivityPriority.LOW:
        return "Baixa"
      default:
        return priority
    }
  }

  const getPriorityColor = (priority: string | ActivityPriority) => {
    switch (priority) {
      case ActivityPriority.HIGH:
        return "bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400"
      case ActivityPriority.MEDIUM:
        return "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400"
      case ActivityPriority.LOW:
        return "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400"
      default:
        return ""
    }
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("pt-BR")
  }

  const isOverdue = (activity: Activity) => {
    if (!activity.due_date) return false
    if (activity.status === ActivityStatus.DONE) return false
    const today = new Date().toISOString().split("T")[0]
    if (!today) return false
    return activity.due_date < today
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn}>
      <Card>
        <CardHeader>
          <div>
            <h3 className="text-lg font-semibold">Lista de Atividades</h3>
            <p className="text-sm text-default-500">
              {activities.length} atividade{activities.length !== 1 ? "s" : ""} encontrada
              {activities.length !== 1 ? "s" : ""}.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Lista de atividades" removeWrapper>
            <TableHeader>
              <TableColumn>Atividade</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Prioridade</TableColumn>
              <TableColumn>Responsável</TableColumn>
              <TableColumn>Vencimento</TableColumn>
              <TableColumn>Etiquetas</TableColumn>
              <TableColumn>Ações</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent="Nenhuma atividade encontrada."
              items={activities}
              isLoading={isLoading}
            >
              {(activity) => (
                <TableRow key={activity.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{activity.title}</p>
                      <p className="text-sm text-default-500 line-clamp-1">
                        {activity.description}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={activity.status as any} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="flat"
                      className={`${getPriorityColor(activity.priority)} text-[10px] [&::before]:hidden [&::after]:hidden`}
                    >
                      {getPriorityLabel(activity.priority)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-default-400" />
                      <span>{activity.assigned_to_name || activity.assigned_to_id || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-default-400" />
                      <span
                        className={
                          isOverdue(activity) ? "text-danger-600 font-medium" : ""
                        }
                      >
                        {formatDate(activity.due_date)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {activity.labels.map((label) => (
                        <LabelChip key={label} label={label} size="sm" />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<Pencil className="h-3.5 w-3.5" />}
                      onPress={() => onSelectActivity?.(activity)}
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </motion.div>
  )
}
