export type ActivityStatus = "todo" | "in-progress" | "review" | "done";
export type ActivityPriority = "low" | "medium" | "high";
export type ActivityRecurrence = "daily" | "weekly" | "monthly";

export interface Activity {
  id: string;
  title: string;
  description: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  assignedTo: string;
  dueDate: string;
  labels: string[];
  recurrence?: ActivityRecurrence;
  reminders: boolean;
}

export const mockActivities: Activity[] = [
  {
    id: "1",
    title: "Revisar declaração de IRPF",
    description: "Revisar e validar a declaração de IRPF do cliente João Silva",
    status: "in-progress",
    priority: "high",
    assignedTo: "Maria Santos",
    dueDate: "2025-01-15",
    labels: ["Fiscal", "Urgente"],
    reminders: true,
  },
  {
    id: "2",
    title: "Enviar DCTFWeb",
    description: "Enviar DCTFWeb para o mês de dezembro/2024",
    status: "todo",
    priority: "high",
    assignedTo: "Pedro Costa",
    dueDate: "2025-01-10",
    labels: ["Fiscal", "Obrigação"],
    reminders: true,
  },
  {
    id: "3",
    title: "Atualizar cadastro de clientes",
    description: "Verificar e atualizar dados cadastrais dos clientes",
    status: "todo",
    priority: "medium",
    assignedTo: "Ana Paula",
    dueDate: "2025-01-20",
    labels: ["Administrativo"],
    reminders: false,
  },
  {
    id: "4",
    title: "Preparar relatório mensal",
    description: "Gerar relatório financeiro mensal para apresentação",
    status: "review",
    priority: "medium",
    assignedTo: "Carlos Mendes",
    dueDate: "2025-01-05",
    labels: ["Relatório", "Financeiro"],
    reminders: true,
  },
  {
    id: "5",
    title: "Reunião com cliente ABC",
    description: "Reunião para discutir planejamento tributário",
    status: "done",
    priority: "high",
    assignedTo: "Maria Santos",
    dueDate: "2025-01-03",
    labels: ["Reunião", "Cliente"],
    reminders: false,
  },
  {
    id: "6",
    title: "Enviar eSocial",
    description: "Enviar eSocial referente ao mês de dezembro",
    status: "in-progress",
    priority: "high",
    assignedTo: "Pedro Costa",
    dueDate: "2025-01-07",
    labels: ["Fiscal", "eSocial"],
    recurrence: "monthly",
    reminders: true,
  },
  {
    id: "7",
    title: "Conferir notas fiscais",
    description: "Conferir notas fiscais recebidas no mês",
    status: "todo",
    priority: "low",
    assignedTo: "Ana Paula",
    dueDate: "2025-01-12",
    labels: ["Fiscal"],
    reminders: false,
  },
  {
    id: "8",
    title: "Atualizar planilha de controle",
    description: "Atualizar planilha de controle de obrigações",
    status: "done",
    priority: "medium",
    assignedTo: "Carlos Mendes",
    dueDate: "2025-01-02",
    labels: ["Administrativo"],
    reminders: false,
  },
];

