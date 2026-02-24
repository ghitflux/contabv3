'use client';

import Link from 'next/link';
import { Button, Card, CardBody } from '@/heroui';
import { AlertTriangle, Clock3 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useActivities } from '@/hooks/useActivities';
import { ActivityStatus, getDaysUntilDate } from '@/types/activity';

const MAX_ACTIVITY_ITEMS = 200;
const REFRESH_INTERVAL_MS = 60_000;

export function ActivityDueSoonBanner() {
  const { activities, fetchActivities } = useActivities();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        await fetchActivities({ page: 1, size: MAX_ACTIVITY_ITEMS });
      } catch {
        if (!mounted) return;
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [fetchActivities]);

  const recurringAlerts = useMemo(() => {
    const items = activities?.items ?? [];
    return items.filter((activity) => {
      if (!activity.recurrence) return false;
      if (activity.status === ActivityStatus.DONE) return false;
      const daysUntilDue = getDaysUntilDate(activity.due_date);
      return daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 5;
    });
  }, [activities?.items]);

  const recurringOverdue = useMemo(() => {
    const items = activities?.items ?? [];
    return items.filter((activity) => {
      if (!activity.recurrence) return false;
      if (activity.status === ActivityStatus.DONE) return false;
      const daysUntilDue = getDaysUntilDate(activity.due_date);
      return daysUntilDue !== null && daysUntilDue < 0;
    });
  }, [activities?.items]);

  if (recurringAlerts.length === 0 && recurringOverdue.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4 border-l-4 border-warning bg-warning-50/70 dark:bg-warning-900/15">
      <CardBody className="py-3 px-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-warning-700 dark:text-warning-300">
          <AlertTriangle className="h-4 w-4" />
          <p className="text-sm">
            {recurringAlerts.length > 0 && (
              <>
                {recurringAlerts.length} atividade{recurringAlerts.length > 1 ? 's' : ''} recorrente
                {recurringAlerts.length > 1 ? 's' : ''} vence{recurringAlerts.length > 1 ? 'm' : ''}{' '}
                em até 5 dias.
              </>
            )}
            {recurringAlerts.length > 0 && recurringOverdue.length > 0 && ' '}
            {recurringOverdue.length > 0 && (
              <>
                {recurringOverdue.length} recorrente{recurringOverdue.length > 1 ? 's' : ''} já está
                pendente.
              </>
            )}
          </p>
        </div>
        <Button
          as={Link}
          href="/atividades"
          size="sm"
          variant="flat"
          color="warning"
          startContent={<Clock3 className="h-4 w-4" />}
        >
          Abrir Atividades
        </Button>
      </CardBody>
    </Card>
  );
}
