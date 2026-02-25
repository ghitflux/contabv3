'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardBody, CardHeader, Button, Spinner, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/heroui';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { fadeIn, staggerItem } from '@/lib/animations';
import { ActivityPriority, formatDateKey, parseDateOnly, type Activity } from '@/types/activity';

type AtividadesCalendarProps = {
  activities: Activity[];
  isLoading?: boolean;
  onSelectActivity?: (activity: Activity) => void;
};

type CalendarView = 'month' | 'week' | 'day';
type RecurrenceType = 'daily' | 'weekly' | 'monthly';

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function normalizeDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getDaysInWeek(date: Date): Date[] {
  const start = normalizeDay(date);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function getBoundsForView(date: Date, view: CalendarView): { start: Date; end: Date } {
  if (view === 'day') {
    const day = normalizeDay(date);
    return { start: day, end: day };
  }

  if (view === 'week') {
    const weekDays = getDaysInWeek(date);
    const start = weekDays[0] ?? normalizeDay(date);
    const end = weekDays[6] ?? normalizeDay(date);
    return { start, end };
  }

  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: normalizeDay(start), end: normalizeDay(end) };
}

function addRecurrenceStep(date: Date, recurrence: RecurrenceType): Date {
  const next = new Date(date);
  if (recurrence === 'daily') {
    next.setDate(next.getDate() + 1);
    return normalizeDay(next);
  }
  if (recurrence === 'weekly') {
    next.setDate(next.getDate() + 7);
    return normalizeDay(next);
  }

  // Monthly recurrence preserving day when possible (e.g. 31 -> 30/28 if needed).
  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, maxDay));
  return normalizeDay(next);
}

function getRecurrenceValue(value: string | null | undefined): RecurrenceType | null {
  if (value === 'daily' || value === 'weekly' || value === 'monthly') {
    return value;
  }
  return null;
}

function getPriorityClasses(priority: string | null | undefined): string {
  if (priority === ActivityPriority.HIGH) {
    return 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400';
  }
  if (priority === ActivityPriority.MEDIUM) {
    return 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400';
  }
  return 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400';
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function parseDateKeyToDate(dateKey: string): Date | null {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function AtividadesCalendar({
  activities,
  isLoading = false,
  onSelectActivity,
}: AtividadesCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(() => normalizeDay(new Date()));
  const [view, setView] = useState<CalendarView>('month');
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const today = useMemo(() => normalizeDay(new Date()), []);
  const visibleBounds = useMemo(() => getBoundsForView(currentDate, view), [currentDate, view]);

  const activitiesByDate = useMemo(() => {
    const map: Record<string, Activity[]> = {};

    const addActivityToMap = (date: Date, activity: Activity) => {
      if (date < visibleBounds.start || date > visibleBounds.end) return;
      const dateKey = formatDateKey(date);
      const existing = map[dateKey] ?? [];
      if (existing.some((item) => item.id === activity.id)) return;
      map[dateKey] = [...existing, activity];
    };

    const addActivityDateRange = (start: Date, end: Date, activity: Activity) => {
      const normalizedStart = normalizeDay(start);
      const normalizedEnd = normalizeDay(end);
      const rangeStart = normalizedStart <= normalizedEnd ? normalizedStart : normalizedEnd;
      const rangeEnd = normalizedStart <= normalizedEnd ? normalizedEnd : normalizedStart;

      const startDate = rangeStart > visibleBounds.start ? rangeStart : visibleBounds.start;
      const endDate = rangeEnd < visibleBounds.end ? rangeEnd : visibleBounds.end;
      if (startDate > endDate) return;

      const cursor = new Date(startDate);
      let safetyCount = 0;
      while (cursor <= endDate && safetyCount < 370) {
        addActivityToMap(cursor, activity);
        cursor.setDate(cursor.getDate() + 1);
        safetyCount += 1;
      }
    };

    activities.forEach((activity) => {
      const dueDate = parseDateOnly(activity.due_date);
      const startDate = parseDateOnly(activity.start_date);
      const endDate = parseDateOnly(activity.end_date);
      const recurrence = getRecurrenceValue(activity.recurrence ?? null);

      const normalizedDueDate = dueDate ? normalizeDay(dueDate) : null;
      const normalizedStartDate = startDate ? normalizeDay(startDate) : null;
      const normalizedEndDate = endDate ? normalizeDay(endDate) : null;

      if (recurrence) {
        const baseDate = normalizedDueDate ?? normalizedStartDate ?? normalizedEndDate;
        if (!baseDate) return;

        let cursor = new Date(baseDate);
        let safetyCount = 0;
        const dayMs = 24 * 60 * 60 * 1000;
        if (cursor < visibleBounds.start) {
          if (recurrence === 'daily') {
            const diffDays = Math.floor(
              (visibleBounds.start.getTime() - cursor.getTime()) / dayMs
            );
            cursor.setDate(cursor.getDate() + Math.max(diffDays, 0));
            cursor = normalizeDay(cursor);
          } else if (recurrence === 'weekly') {
            const diffWeeks = Math.floor(
              (visibleBounds.start.getTime() - cursor.getTime()) / (dayMs * 7)
            );
            cursor.setDate(cursor.getDate() + Math.max(diffWeeks, 0) * 7);
            cursor = normalizeDay(cursor);
          }
        }
        while (cursor < visibleBounds.start && safetyCount < 500) {
          cursor = addRecurrenceStep(cursor, recurrence);
          safetyCount += 1;
        }
        while (cursor <= visibleBounds.end && safetyCount < 500) {
          addActivityToMap(cursor, activity);
          cursor = addRecurrenceStep(cursor, recurrence);
          safetyCount += 1;
        }
        return;
      }

      if (normalizedStartDate && normalizedEndDate) {
        addActivityDateRange(normalizedStartDate, normalizedEndDate, activity);
        return;
      }

      const singleDate = normalizedDueDate ?? normalizedStartDate ?? normalizedEndDate;
      if (!singleDate) return;
      addActivityToMap(singleDate, activity);
    });

    return map;
  }, [activities, visibleBounds]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getActivitiesForDate = (date: Date | null) => {
    if (!date) return [];
    const dateStr = formatDateKey(date);
    return activitiesByDate[dateStr] ?? [];
  };

  const getDaysForView = () => {
    if (view === 'month') return getDaysInMonth(currentDate);
    if (view === 'week') return getDaysInWeek(currentDate);
    return [currentDate];
  };

  const navigateDate = (direction: number) => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
      return;
    }
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + (view === 'week' ? 7 * direction : direction));
    setCurrentDate(next);
  };

  const days = getDaysForView();
  const dayHeaders = view === 'day' ? [dayNames[currentDate.getDay()]] : dayNames;
  const gridColsClass = view === 'day' ? 'grid-cols-1' : 'grid-cols-7';
  const todayKey = formatDateKey(today);
  const selectedDayDate = selectedDayKey ? parseDateKeyToDate(selectedDayKey) : null;
  const selectedDayActivities = selectedDayKey ? activitiesByDate[selectedDayKey] ?? [] : [];
  const selectedDayLabel = selectedDayDate ? formatDateLabel(selectedDayDate) : '';

  const openDayTasksModal = (date: Date) => {
    setSelectedDayKey(formatDateKey(date));
  };

  const closeDayTasksModal = () => {
    setSelectedDayKey(null);
  };

  const headerLabel = useMemo(() => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    }
    if (view === 'week') {
      const weekDays = getDaysInWeek(currentDate);
      const firstDay = weekDays[0];
      const lastDay = weekDays[6];
      if (!firstDay || !lastDay) return '';
      return `${firstDay.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      })} - ${lastDay.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}`;
    }
    return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [currentDate, view]);

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <h3 className="text-lg font-semibold">{headerLabel}</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={view === 'month' ? 'solid' : 'bordered'}
                  color={view === 'month' ? 'primary' : 'default'}
                  onPress={() => setView('month')}
                >
                  Mês
                </Button>
                <Button
                  size="sm"
                  variant={view === 'week' ? 'solid' : 'bordered'}
                  color={view === 'week' ? 'primary' : 'default'}
                  onPress={() => setView('week')}
                >
                  Semana
                </Button>
                <Button
                  size="sm"
                  variant={view === 'day' ? 'solid' : 'bordered'}
                  color={view === 'day' ? 'primary' : 'default'}
                  onPress={() => setView('day')}
                >
                  Dia
                </Button>
              </div>
              <div className="flex gap-1">
                <Button isIconOnly size="sm" variant="bordered" onPress={() => navigateDate(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button isIconOnly size="sm" variant="bordered" onPress={() => navigateDate(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {isLoading && (
            <div className="flex justify-center py-4">
              <Spinner size="sm" color="primary" />
            </div>
          )}
          <div className={`grid ${gridColsClass} gap-2`}>
            {dayHeaders.map((day) => (
              <div key={day} className="text-center font-semibold text-sm text-default-500 py-2">
                {day}
              </div>
            ))}
            {days.map((day, index) => {
              const dayActivities = getActivitiesForDate(day);
              const dayKey = day ? formatDateKey(day) : `empty-${index}`;
              const isToday = Boolean(day && dayKey === todayKey);
              const previewActivities = view === 'month' ? dayActivities.slice(0, 2) : dayActivities;
              const hasHiddenActivities = view === 'month' && dayActivities.length > previewActivities.length;
              const canOpenDayTasks = Boolean(day && dayActivities.length > 0);
              return (
                <motion.div
                  key={dayKey}
                  variants={staggerItem}
                  className={`min-h-[100px] p-2 border border-default-200 rounded-lg ${
                    day ? 'bg-background' : 'bg-default-50 dark:bg-default-100/10'
                  } ${isToday ? 'ring-2 ring-primary' : ''} ${
                    canOpenDayTasks ? 'cursor-pointer' : ''
                  }`}
                  role={canOpenDayTasks ? 'button' : undefined}
                  tabIndex={canOpenDayTasks ? 0 : undefined}
                  onClick={() => {
                    if (day && canOpenDayTasks) {
                      openDayTasksModal(day);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!day || !canOpenDayTasks) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openDayTasksModal(day);
                    }
                  }}
                >
                  {day && (
                    <>
                      <div
                        className={`text-sm font-medium mb-2 ${
                          isToday ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {day.getDate()}
                      </div>
                      <div className={`space-y-1 ${view !== 'month' ? 'max-h-[220px] overflow-y-auto pr-1' : ''}`}>
                        {previewActivities.map((activity) => (
                          <button
                            type="button"
                            key={activity.id}
                            className={`text-xs p-1 rounded truncate w-full text-left ${getPriorityClasses(
                              activity.priority
                            )}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectActivity?.(activity);
                            }}
                          >
                            {activity.title}
                          </button>
                        ))}
                        {hasHiddenActivities && day && (
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              openDayTasksModal(day);
                            }}
                          >
                            Ver todas ({dayActivities.length})
                          </button>
                        )}
                        {!hasHiddenActivities && dayActivities.length > 0 && view === 'month' && (
                          <span className="text-[11px] text-default-500">Clique no dia para ver todas.</span>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Modal
        isOpen={Boolean(selectedDayKey)}
        onOpenChange={(open) => !open && closeDayTasksModal()}
        size="lg"
        scrollBehavior="inside"
        classNames={{
          base: 'max-h-[calc(100vh-2rem)]',
          body: 'overflow-y-auto',
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Tarefas do dia {selectedDayLabel}</ModalHeader>
              <ModalBody className="max-h-[70vh] overflow-y-auto">
                {selectedDayActivities.length === 0 ? (
                  <p className="text-sm text-default-500">Nenhuma tarefa neste dia.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayActivities.map((activity) => (
                      <button
                        type="button"
                        key={activity.id}
                        className={`w-full rounded-md p-2 text-left text-sm ${getPriorityClasses(
                          activity.priority
                        )}`}
                        onClick={() => {
                          onSelectActivity?.(activity);
                          onClose();
                        }}
                      >
                        <span className="font-medium">{activity.title}</span>
                        {activity.description && (
                          <span className="block text-xs opacity-80 line-clamp-2 mt-1">
                            {activity.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Fechar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
