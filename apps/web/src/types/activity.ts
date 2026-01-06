/**
 * Activity types and helpers.
 */

export enum ActivityStatus {
  TODO = "todo",
  IN_PROGRESS = "in-progress",
  REVIEW = "review",
  DONE = "done",
}

export enum ActivityPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export enum ActivityRecurrence {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
}

export interface ActivityBase {
  title: string;
  description?: string | null;
  status: ActivityStatus | string;
  priority: ActivityPriority | string;
  assigned_to_id: string;
  due_date?: string | null;
  labels?: string[] | null;
  recurrence?: ActivityRecurrence | string | null;
  reminders?: boolean;
}

export interface ActivityCreate extends Omit<ActivityBase, 'status' | 'priority' | 'labels'> {
  status?: ActivityStatus | string;
  priority?: ActivityPriority | string;
  labels?: string[];
}

export interface ActivityUpdate extends Partial<ActivityBase> {}

export interface Activity extends ActivityBase {
  id: string;
  labels: string[];
  recurrence?: ActivityRecurrence | string | null;
  reminders: boolean;
  created_by_id: string;
  created_at?: string;
  updated_at?: string;
  assigned_to_name?: string | null;
}

export interface ActivityFilters {
  query?: string;
  status?: ActivityStatus | string;
  priority?: ActivityPriority | string;
  assigned_to_id?: string;
  due_date?: string;
  page?: number;
  size?: number;
}

export interface ActivityListResponse {
  items: Activity[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export function getActivityStatusLabel(status: ActivityStatus | string): string {
  const normalized = status?.toString() as ActivityStatus | string;
  const labels: Record<ActivityStatus, string> = {
    [ActivityStatus.TODO]: "A Fazer",
    [ActivityStatus.IN_PROGRESS]: "Em Andamento",
    [ActivityStatus.REVIEW]: "Revisão",
    [ActivityStatus.DONE]: "Concluído",
  };
  return labels[normalized as ActivityStatus] ?? status?.toString?.() ?? "-";
}

export function getActivityPriorityLabel(priority: ActivityPriority | string): string {
  const normalized = priority?.toString() as ActivityPriority | string;
  const labels: Record<ActivityPriority, string> = {
    [ActivityPriority.LOW]: "Baixa",
    [ActivityPriority.MEDIUM]: "Média",
    [ActivityPriority.HIGH]: "Alta",
  };
  return labels[normalized as ActivityPriority] ?? priority?.toString?.() ?? "-";
}
