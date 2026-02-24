'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Card, CardBody } from '@/heroui';
import { Calendar, ExternalLink, GripVertical, LayoutGrid, Pencil, User } from 'lucide-react';
import { staggerContainer, staggerItem, cardHover } from '@/lib/animations';
import { LabelChip } from '@/components/ui/LabelChip';
import type { Activity } from '@/types/activity';
import { ActivityPriority, ActivityStatus, getTodayDateKey, parseDateOnly } from '@/types/activity';
import { getActivityVisibleLabels } from '@/lib/activityMetadata';

type AtividadesKanbanProps = {
  activities: Activity[];
  isLoading?: boolean;
  clientNameById?: Record<string, string>;
  onMove: (activityId: string, status: ActivityStatus) => Promise<void>;
  onSelectActivity?: (activity: Activity) => void;
  onOpenLinkedObligation?: (obligationId: string) => void;
};

export function AtividadesKanban({
  activities,
  isLoading = false,
  clientNameById = {},
  onMove,
  onSelectActivity,
  onOpenLinkedObligation,
}: AtividadesKanbanProps) {
  const [draggedActivityId, setDraggedActivityId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [movingActivityId, setMovingActivityId] = useState<string | null>(null);
  const [dragHandleActivityId, setDragHandleActivityId] = useState<string | null>(null);

  const columns = [
    {
      id: ActivityStatus.TODO,
      title: 'A Fazer',
      color:
        'bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/30 dark:to-slate-900/20',
      headerColor: 'text-slate-700 dark:text-slate-300',
      borderColor: 'border-t-3 border-slate-500',
    },
    {
      id: ActivityStatus.IN_PROGRESS,
      title: 'Em Andamento',
      color: 'bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-950/20',
      headerColor: 'text-blue-700 dark:text-blue-300',
      borderColor: 'border-t-3 border-blue-500',
    },
    {
      id: ActivityStatus.REVIEW,
      title: 'Revisão',
      color:
        'bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-950/20',
      headerColor: 'text-amber-700 dark:text-amber-300',
      borderColor: 'border-t-3 border-amber-500',
    },
    {
      id: ActivityStatus.DONE,
      title: 'Concluído',
      color:
        'bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-950/20',
      headerColor: 'text-emerald-700 dark:text-emerald-300',
      borderColor: 'border-t-3 border-emerald-500',
    },
  ];

  const getPriorityColor = (priority: string | ActivityPriority) => {
    switch (priority) {
      case ActivityPriority.HIGH:
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case ActivityPriority.MEDIUM:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case ActivityPriority.LOW:
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      default:
        return 'bg-default-100 text-default-700';
    }
  };

  const getPriorityBorder = (priority: string | ActivityPriority) => {
    switch (priority) {
      case ActivityPriority.HIGH:
        return 'border-l-3 border-red-500';
      case ActivityPriority.MEDIUM:
        return 'border-l-3 border-amber-500';
      case ActivityPriority.LOW:
        return 'border-l-3 border-emerald-500';
      default:
        return '';
    }
  };

  const handleDragStart = (event: React.DragEvent, activityId: string) => {
    if (dragHandleActivityId !== activityId) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('text/plain', activityId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedActivityId(activityId);
  };

  const handleDragEnd = () => {
    setDraggedActivityId(null);
    setDragOverColumn(null);
    setDragHandleActivityId(null);
  };

  const handleDragOver = (event: React.DragEvent, columnId: string) => {
    event.preventDefault();
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDrop = async (event: React.DragEvent, columnId: ActivityStatus) => {
    event.preventDefault();
    const activityId = event.dataTransfer.getData('text/plain') || draggedActivityId || '';
    if (!activityId) return;

    const activity = activities.find((item) => item.id === activityId);
    if (!activity || activity.status === columnId) {
      handleDragEnd();
      return;
    }

    try {
      setMovingActivityId(activityId);
      await onMove(activityId, columnId);
    } finally {
      setMovingActivityId(null);
      handleDragEnd();
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    const parsed = parseDateOnly(date);
    if (!parsed) return date;
    return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const todayDate = getTodayDateKey();

  return (
    <div className="space-y-4">
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {columns.map((column) => {
          const columnActivities = activities.filter((a) => a.status === column.id);
          const isDroppable = dragOverColumn === column.id;

          return (
            <motion.div key={column.id} variants={staggerItem}>
              <Card
                className={`${column.color} ${column.borderColor} ${
                  isDroppable ? 'ring-2 ring-primary shadow-lg' : ''
                } relative transition-all duration-200`}
              >
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between w-full">
                    <h3 className={`text-base font-bold ${column.headerColor}`}>{column.title}</h3>
                    <span
                      className={`inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-white/60 dark:bg-black/20 ${column.headerColor} text-xs font-bold shadow-sm`}
                    >
                      {isLoading ? '...' : columnActivities.length}
                    </span>
                  </div>
                </div>
                <CardBody
                  className="space-y-3 min-h-[220px]"
                  onDragOver={(event) => handleDragOver(event, column.id)}
                  onDrop={(event) => handleDrop(event, column.id)}
                >
                  {columnActivities.map((activity) => {
                    const visibleLabels = getActivityVisibleLabels(activity);
                    const linkedCompanyNames = (activity.linked_client_ids ?? [])
                      .map((id) => clientNameById[id])
                      .filter(Boolean);
                    const isPending =
                      activity.status !== ActivityStatus.DONE &&
                      Boolean(activity.due_date && activity.due_date < todayDate);
                    const hasLinkedObligation = Boolean(activity.linked_obligation_id);

                    return (
                      <motion.div
                        key={activity.id}
                        variants={cardHover}
                        initial="rest"
                        whileHover="hover"
                        whileTap="tap"
                      >
                        <Card
                          className={`bg-background cursor-grab hover:shadow-lg transition-all duration-200 ${getPriorityBorder(activity.priority)} ${
                            movingActivityId === activity.id ? 'opacity-60' : ''
                          } ${draggedActivityId === activity.id ? 'opacity-50 scale-95' : ''}`}
                          draggable={dragHandleActivityId === activity.id}
                          onDragStart={(event) => handleDragStart(event, activity.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => onSelectActivity?.(activity)}
                        >
                          <CardBody className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2">
                                <button
                                  type="button"
                                  className="mt-0.5 cursor-grab text-default-300 hover:text-default-500"
                                  title="Arrastar atividade"
                                  onMouseDown={() => setDragHandleActivityId(activity.id)}
                                  onMouseUp={() => setDragHandleActivityId(null)}
                                  onMouseLeave={() => setDragHandleActivityId(null)}
                                  onTouchStart={() => setDragHandleActivityId(activity.id)}
                                  onTouchEnd={() => setDragHandleActivityId(null)}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <GripVertical className="h-4 w-4" />
                                </button>
                                <h4 className="font-medium text-sm leading-tight">
                                  {activity.title}
                                </h4>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onSelectActivity?.(activity);
                                  }}
                                  title="Abrir atividade"
                                  className="min-w-unit-6"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <span
                                  className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm ${getPriorityColor(
                                    activity.priority
                                  )}`}
                                >
                                  {activity.priority === ActivityPriority.HIGH
                                    ? 'ALTA'
                                    : activity.priority === ActivityPriority.MEDIUM
                                      ? 'MÉDIA'
                                      : 'BAIXA'}
                                </span>
                              </div>
                            </div>
                            {activity.description && (
                              <p className="text-xs text-default-500 line-clamp-2">
                                {activity.description}
                              </p>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-semibold bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300">
                                Pendente (vencida)
                              </span>
                            )}
                            {linkedCompanyNames.length > 0 && (
                              <p className="text-[11px] text-default-500 truncate">
                                Empresas: {linkedCompanyNames.join(', ')}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1">
                              {visibleLabels.map((label) => (
                                <LabelChip key={label} label={label} size="sm" />
                              ))}
                            </div>
                            <div className="flex items-center justify-between text-xs text-default-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDate(activity.due_date)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span className="truncate max-w-[140px]">
                                  {activity.assigned_to_name || activity.assigned_to_id || '-'}
                                </span>
                              </div>
                            </div>
                            {hasLinkedObligation && onOpenLinkedObligation && (
                              <Button
                                size="sm"
                                variant="flat"
                                color="primary"
                                startContent={<ExternalLink className="h-3.5 w-3.5" />}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onOpenLinkedObligation(activity.linked_obligation_id as string);
                                }}
                              >
                                Abrir obrigação
                              </Button>
                            )}
                            {activity.recurrence && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-default-100 dark:bg-default-100/20 text-default-700 dark:text-default-400">
                                Recorrente:{' '}
                                {activity.recurrence === 'daily'
                                  ? 'Diária'
                                  : activity.recurrence === 'weekly'
                                    ? 'Semanal'
                                    : 'Mensal'}
                              </span>
                            )}
                          </CardBody>
                        </Card>
                      </motion.div>
                    );
                  })}
                  {columnActivities.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      {isDroppable ? (
                        <>
                          <div className="p-4 rounded-full bg-primary/10 mb-3">
                            <GripVertical className="h-6 w-6 text-primary" />
                          </div>
                          <p className="text-sm font-medium text-primary">Solte aqui para mover</p>
                        </>
                      ) : (
                        <>
                          <div className="p-4 rounded-full bg-default-100 dark:bg-default-100/20 mb-3">
                            <LayoutGrid className="h-6 w-6 text-default-400" />
                          </div>
                          <p className="text-sm text-default-400">Nenhuma atividade</p>
                        </>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
