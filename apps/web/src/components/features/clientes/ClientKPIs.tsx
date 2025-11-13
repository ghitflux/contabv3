'use client';

import { CheckCircleIcon, ClockIcon, DollarSignIcon, UsersIcon } from '@/lib/icons';
import type { ClientStats } from '@/types/client';
import { Card, CardBody } from '@heroui/react';
import React from 'react';

interface KPICardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

const KPICard = React.memo(({ label, value, icon: Icon, color = 'default' }: KPICardProps) => {
  const colorClasses = {
    default: 'bg-default-100 border-default-200',
    primary: 'bg-primary-50 dark:bg-primary-100/10 border-primary-200 dark:border-primary-400/20',
    success: 'bg-success-50 dark:bg-success-100/10 border-success-200 dark:border-success-400/20',
    warning: 'bg-warning-50 dark:bg-warning-100/10 border-warning-200 dark:border-warning-400/20',
    danger: 'bg-danger-50 dark:bg-danger-100/10 border-danger-200 dark:border-danger-400/20',
  };

  const iconColorClasses = {
    default: 'text-default-600 dark:text-default-500',
    primary: 'text-primary-600 dark:text-primary-400',
    success: 'text-success-600 dark:text-success-400',
    warning: 'text-warning-600 dark:text-warning-400',
    danger: 'text-danger-600 dark:text-danger-400',
  };

  return (
    <Card className={`border ${colorClasses[color]}`}>
      <CardBody className="flex flex-row items-center justify-between p-4">
        <div>
          <p className="text-sm text-default-600 dark:text-default-400">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${iconColorClasses[color]}`} />
      </CardBody>
    </Card>
  );
});

KPICard.displayName = 'KPICard';

interface ClientKPIsProps {
  stats: ClientStats | null;
  isLoading?: boolean;
}

export function ClientKPIs({ stats, isLoading }: ClientKPIsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardBody className="p-4">
              <div className="h-16 bg-default-200 dark:bg-default-100 rounded"></div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      <KPICard label="Total de Clientes" value={stats.total} icon={UsersIcon} color="default" />
      <KPICard
        label="Clientes Ativos"
        value={stats.ativos}
        icon={CheckCircleIcon}
        color="success"
      />
      <KPICard label="Pendentes" value={stats.pendentes} icon={ClockIcon} color="warning" />
      <KPICard
        label="Receita Mensal"
        value={formatCurrency(stats.receita_total)}
        icon={DollarSignIcon}
        color="primary"
      />
    </div>
  );
}
