'use client';

import { Card, CardBody, CardHeader } from '@/heroui';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export type FinanceiroKpiTrend = 'up' | 'down' | 'neutral';

export interface FinanceiroKpi {
  id?: string;
  title: string;
  value: string;
  change: string;
  trend: FinanceiroKpiTrend;
  icon: LucideIcon;
  colorClass: string;
  backgroundClass: string;
  isPressable?: boolean;
  onPress?: () => void;
}

const defaultKpis: FinanceiroKpi[] = [
  {
    title: 'Receita Total',
    value: 'R$ 245.890,00',
    change: '+12,5%',
    trend: 'up',
    icon: DollarSign,
    colorClass: 'text-green-600',
    backgroundClass: 'bg-green-50 dark:bg-green-900/20',
  },
  {
    title: 'Despesas',
    value: 'R$ 89.450,00',
    change: '+5,2%',
    trend: 'up',
    icon: TrendingDown,
    colorClass: 'text-red-600',
    backgroundClass: 'bg-red-50 dark:bg-red-900/20',
  },
  {
    title: 'Lucro Líquido',
    value: 'R$ 156.440,00',
    change: '+18,3%',
    trend: 'up',
    icon: TrendingUp,
    colorClass: 'text-teal-600',
    backgroundClass: 'bg-teal-50 dark:bg-teal-900/20',
  },
  {
    title: 'A Receber',
    value: 'R$ 45.230,00',
    change: '15 faturas',
    trend: 'neutral',
    icon: ArrowUpRight,
    colorClass: 'text-primary-600',
    backgroundClass: 'bg-primary-50 dark:bg-primary-900/20',
  },
  {
    title: 'A Pagar',
    value: 'R$ 23.890,00',
    change: '8 contas',
    trend: 'neutral',
    icon: ArrowDownRight,
    colorClass: 'text-amber-600',
    backgroundClass: 'bg-amber-50 dark:bg-amber-900/20',
  },
  {
    title: 'Saldo do Mês',
    value: 'R$ 66.550,00',
    change: '+22,1%',
    trend: 'up',
    icon: Calendar,
    colorClass: 'text-purple-600',
    backgroundClass: 'bg-purple-50 dark:bg-purple-900/20',
  },
];

interface FinanceiroKPIsProps {
  kpis?: FinanceiroKpi[];
}

export function FinanceiroKPIs({ kpis = defaultKpis }: FinanceiroKPIsProps) {
  const getTrendClasses = (trend: FinanceiroKpiTrend) => {
    if (trend === 'up') {
      return 'text-green-600 dark:text-green-400';
    }
    if (trend === 'down') {
      return 'text-red-600 dark:text-red-400';
    }
    return 'text-slate-600 dark:text-slate-400';
  };

  const renderTrendIcon = (trend: FinanceiroKpiTrend) => {
    if (trend === 'up') {
      return <TrendingUp className="h-4 w-4" />;
    }
    if (trend === 'down') {
      return <TrendingDown className="h-4 w-4" />;
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const isPressable = Boolean(kpi.isPressable && kpi.onPress);

        return (
          <Card
            key={kpi.id ?? kpi.title}
            isPressable={isPressable}
            onPress={kpi.onPress}
            className={`border border-default-200/50 dark:border-default-100/20 ${
              isPressable ? 'cursor-pointer transition-transform hover:-translate-y-0.5' : ''
            }`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{kpi.title}</p>
              <div className={`p-2 rounded-lg ${kpi.backgroundClass}`}>
                <Icon className={`h-4 w-4 ${kpi.colorClass}`} />
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {kpi.value}
              </div>
              <p className={`text-xs flex items-center gap-1 mt-1 ${getTrendClasses(kpi.trend)}`}>
                {renderTrendIcon(kpi.trend)}
                {kpi.change}
              </p>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
