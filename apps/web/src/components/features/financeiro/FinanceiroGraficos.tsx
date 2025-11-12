"use client";

import { Card, CardBody, CardHeader } from "@/heroui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ReceitaDespesaEntry = {
  mes: string;
  receita: number;
  despesa: number;
};

type CategoriaEntry = {
  name: string;
  value: number;
  color: string;
};

interface FinanceiroGraficosProps {
  receitaDespesa?: ReceitaDespesaEntry[];
  categoriasDespesas?: CategoriaEntry[];
  categoriasReceitas?: CategoriaEntry[];
}

const defaultReceitaDespesa: ReceitaDespesaEntry[] = [
  { mes: "Jul", receita: 185000, despesa: 75000 },
  { mes: "Ago", receita: 198000, despesa: 82000 },
  { mes: "Set", receita: 210000, despesa: 78000 },
  { mes: "Out", receita: 225000, despesa: 85000 },
  { mes: "Nov", receita: 238000, despesa: 88000 },
  { mes: "Dez", receita: 245890, despesa: 89450 },
];

const defaultCategoriasDespesas: CategoriaEntry[] = [
  { name: "Despesas Fixas", value: 35000, color: "#ef4444" },
  { name: "Despesas Operacionais", value: 28000, color: "#f59e0b" },
  { name: "Impostos", value: 18450, color: "#8b5cf6" },
  { name: "Folha de Pagamento", value: 8000, color: "#3b82f6" },
];

const defaultCategoriasReceitas: CategoriaEntry[] = [
  { name: "Serviços Contábeis", value: 180000, color: "#10b981" },
  { name: "Consultoria Fiscal", value: 45890, color: "#0d9488" },
  { name: "Serviços Especializados", value: 20000, color: "#06b6d4" },
];

export function FinanceiroGraficos({
  receitaDespesa = defaultReceitaDespesa,
  categoriasDespesas = defaultCategoriasDespesas,
  categoriasReceitas = defaultCategoriasReceitas,
}: FinanceiroGraficosProps) {
  const currencyFormatter = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="lg:col-span-2 border border-default-200/50 dark:border-default-100/20">
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Receita vs Despesa (Últimos 6 meses)
          </h3>
        </CardHeader>
        <CardBody className="pb-6">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={receitaDespesa}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => currencyFormatter(value)}
              />
              <Legend />
              <Line type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={2} name="Receita" />
              <Line type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={2} name="Despesa" />
            </LineChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Despesas por Categoria</h3>
        </CardHeader>
        <CardBody className="pb-6">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoriasDespesas}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {categoriasDespesas.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => currencyFormatter(value)} />
            </PieChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card className="border border-default-200/50 dark:border-default-100/20">
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Receitas por Categoria</h3>
        </CardHeader>
        <CardBody className="pb-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoriasReceitas} barCategoryGap={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => currencyFormatter(value)}
              />
              <Bar dataKey="value" name="Receita">
                {categoriasReceitas.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    </div>
  );
}

