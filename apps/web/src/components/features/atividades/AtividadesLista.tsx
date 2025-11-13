"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Badge,
} from "@/heroui"
import { Search, Filter, Calendar, User } from "lucide-react"
import { mockActivities } from "@/lib/mocks/activities"
import { fadeIn, staggerItem } from "@/lib/animations"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { LabelChip } from "@/components/ui/LabelChip"

export function AtividadesLista() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterPriority, setFilterPriority] = useState("all")

  const filteredActivities = useMemo(() => {
    return mockActivities.filter((activity) => {
      const matchSearch =
        searchTerm === "" ||
        activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.assignedTo.toLowerCase().includes(searchTerm.toLowerCase())

      const matchStatus = filterStatus === "all" || activity.status === filterStatus
      const matchPriority = filterPriority === "all" || activity.priority === filterPriority

      return matchSearch && matchStatus && matchPriority
    })
  }, [searchTerm, filterStatus, filterPriority])

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "todo":
        return "A Fazer"
      case "in-progress":
        return "Em Andamento"
      case "review":
        return "Revisão"
      case "done":
        return "Concluído"
      default:
        return status
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Alta"
      case "medium":
        return "Média"
      case "low":
        return "Baixa"
      default:
        return priority
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400"
      case "medium":
        return "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400"
      case "low":
        return "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400"
      default:
        return ""
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR")
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn}>
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Lista de Atividades</h3>
        </CardHeader>
        <CardBody className="space-y-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar atividades..."
                value={searchTerm}
                onValueChange={setSearchTerm}
                startContent={<Search className="h-4 w-4 text-default-400" />}
                size="sm"
              />
            </div>
            <Select
              label="Status"
              selectedKeys={filterStatus === "all" ? [] : [filterStatus]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string | undefined
                setFilterStatus(value || "all")
              }}
              size="sm"
              className="w-full lg:w-[180px]"
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
              className="w-full lg:w-[180px]"
            >
              <SelectItem key="all">Todas</SelectItem>
              <SelectItem key="high">Alta</SelectItem>
              <SelectItem key="medium">Média</SelectItem>
              <SelectItem key="low">Baixa</SelectItem>
            </Select>
          </div>

          <Table aria-label="Lista de atividades" removeWrapper>
            <TableHeader>
              <TableColumn>Atividade</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Prioridade</TableColumn>
              <TableColumn>Responsável</TableColumn>
              <TableColumn>Vencimento</TableColumn>
              <TableColumn>Etiquetas</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent="Nenhuma atividade encontrada."
              items={filteredActivities}
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
                      <span>{activity.assignedTo}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-default-400" />
                      <span>{formatDate(activity.dueDate)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {activity.labels.map((label) => (
                        <LabelChip key={label} label={label} size="sm" />
                      ))}
                    </div>
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

