'use client';

import { Card } from '@heroui/react';
import { CheckCircleIcon, ClockIcon, AlertCircleIcon } from '@/lib/icons';

interface ObligationTimelineProps {
  obligationId: string;
}

export function ObligationTimeline({ obligationId }: ObligationTimelineProps) {
  // TODO: Buscar histórico/timeline da obrigação do backend
  // Por enquanto, exibir placeholder

  const mockTimeline = [
    {
      id: '1',
      date: new Date().toISOString(),
      status: 'created',
      description: 'Obrigação criada',
      icon: ClockIcon,
    },
    {
      id: '2',
      date: new Date(Date.now() - 86400000).toISOString(),
      status: 'pending',
      description: 'Aguardando documentação',
      icon: AlertCircleIcon,
    },
  ];

  return (
    <div className="space-y-4">
      <h4 className="font-semibold">Histórico</h4>
      <div className="space-y-3">
        {mockTimeline.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                {index < mockTimeline.length - 1 && (
                  <div className="h-full w-px bg-divider my-1" />
                )}
              </div>
              <Card className="flex-1 p-3">
                <p className="text-sm font-medium">{item.description}</p>
                <p className="text-xs text-default-500">
                  {new Date(item.date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
