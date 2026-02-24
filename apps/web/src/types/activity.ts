/**
 * Activity types and helpers.
 */

export enum ActivityStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in-progress',
  REVIEW = 'review',
  DONE = 'done',
}

export enum ActivityPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum ActivityRecurrence {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export interface ActivityBase {
  title: string;
  description?: string | null;
  status: ActivityStatus | string;
  priority: ActivityPriority | string;
  assigned_to_id: string;
  due_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  labels?: string[] | null;
  linked_client_ids?: string[] | null;
  linked_obligation_id?: string | null;
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
  linked_client_ids: string[];
  linked_obligation_id?: string | null;
  is_obligation_activity?: boolean;
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
    [ActivityStatus.TODO]: 'A Fazer',
    [ActivityStatus.IN_PROGRESS]: 'Em Andamento',
    [ActivityStatus.REVIEW]: 'Revisão',
    [ActivityStatus.DONE]: 'Concluído',
  };
  return labels[normalized as ActivityStatus] ?? status?.toString?.() ?? '-';
}

export function getActivityPriorityLabel(priority: ActivityPriority | string): string {
  const normalized = priority?.toString() as ActivityPriority | string;
  const labels: Record<ActivityPriority, string> = {
    [ActivityPriority.LOW]: 'Baixa',
    [ActivityPriority.MEDIUM]: 'Média',
    [ActivityPriority.HIGH]: 'Alta',
  };
  return labels[normalized as ActivityPriority] ?? priority?.toString?.() ?? '-';
}

export function normalizeDateOnly(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const [datePart] = value.split('T');
    if (!datePart) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
  }
  const parsed = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = normalizeDateOnly(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateKey(): string {
  return formatDateKey(new Date());
}

export function getDaysUntilDate(
  dateValue: string | null | undefined,
  referenceDate: Date = new Date()
): number | null {
  const targetDate = parseDateOnly(dateValue);
  if (!targetDate) return null;

  const current = new Date(referenceDate);
  current.setHours(0, 0, 0, 0);

  const diffMs = targetDate.getTime() - current.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
