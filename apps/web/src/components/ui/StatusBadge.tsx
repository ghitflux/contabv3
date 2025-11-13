"use client"

import { Chip } from "@/heroui"
import type { ChipProps } from "@heroui/react"

export type StatusType =
  | "ativo"
  | "inativo"
  | "pendente"
  | "todo"
  | "in-progress"
  | "review"
  | "done"
  | "completed"
  | "expired"
  | "renewing"
  | "pending"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "obligation"
  | "default"

export type StatusBadgeColor = "success" | "warning" | "danger" | "primary" | "default" | "secondary"

interface StatusBadgeProps extends Omit<ChipProps, "color" | "children"> {
  status: StatusType
  label?: string
}

const statusConfig: Record<
  StatusType,
  { color: StatusBadgeColor; label: string }
> = {
  // Clientes
  ativo: { color: "success", label: "Ativo" },
  inativo: { color: "default", label: "Inativo" },
  pendente: { color: "warning", label: "Pendente" },

  // Atividades
  todo: { color: "default", label: "A Fazer" },
  "in-progress": { color: "primary", label: "Em Andamento" },
  review: { color: "warning", label: "Revisão" },
  done: { color: "success", label: "Concluído" },
  completed: { color: "success", label: "Concluído" },

  // Licenças
  expired: { color: "danger", label: "Expirado" },
  renewing: { color: "warning", label: "Renovando" },
  pending: { color: "warning", label: "Pendente" },

  // Genéricos
  success: { color: "success", label: "Sucesso" },
  warning: { color: "warning", label: "Aviso" },
  danger: { color: "danger", label: "Urgente" },
  info: { color: "primary", label: "Informação" },
  default: { color: "default", label: "Padrão" },
}

export function StatusBadge({ status, label, size = "sm", variant = "flat", className, ...props }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.default
  const displayLabel = label || config.label

  return (
    <Chip
      color={config.color}
      size={size}
      variant={variant}
      className={`[&::before]:hidden [&::after]:hidden ${className || ""}`}
      {...props}
    >
      {displayLabel}
    </Chip>
  )
}

