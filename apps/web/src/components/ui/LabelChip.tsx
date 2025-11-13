"use client"

import { Chip } from "@/heroui"
import { Tag } from "lucide-react"

interface LabelChipProps {
  label: string
  size?: "sm" | "md" | "lg"
}

const labelColorMap: Record<string, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = {
  // Fiscal
  Fiscal: "primary",
  "eSocial": "primary",
  Obrigação: "primary",

  // Administrativo
  Administrativo: "default",

  // Financeiro
  Financeiro: "success",
  Relatório: "success",

  // Cliente/Reunião
  Cliente: "secondary",
  Reunião: "secondary",

  // Urgente
  Urgente: "danger",
}

export function LabelChip({ label, size = "sm" }: LabelChipProps) {
  const color = labelColorMap[label] || "default"

  return (
    <Chip
      variant="flat"
      size={size}
      color={color}
      className="text-xs [&::before]:hidden [&::after]:hidden"
      startContent={<Tag className="h-3 w-3" />}
    >
      {label}
    </Chip>
  )
}

