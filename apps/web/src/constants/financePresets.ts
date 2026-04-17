export type FinanceHistoryType = 'income' | 'expense' | 'profit_distribution';

export type FinanceHistoryPreset = {
  id: string;
  description: string;
  type: FinanceHistoryType;
  group: string;
};

const FINANCE_PRESET_DEFINITIONS: Array<{
  description: string;
  type: FinanceHistoryType;
  group: string;
}> = [
  { description: 'Honorários do mês', type: 'income', group: 'Receitas Operacionais' },
  { description: 'Serviço extra', type: 'income', group: 'Receitas Operacionais' },
  {
    description: 'Recebimento de cliente',
    type: 'income',
    group: 'Receitas Operacionais',
  },
  {
    description: 'Recebimento de honorários contábeis - mensalidade',
    type: 'income',
    group: 'Receitas Operacionais',
  },
  {
    description: 'Recebimento de honorários - serviços avulsos',
    type: 'income',
    group: 'Receitas Operacionais',
  },
  {
    description: 'Recebimento comissão certificado digital',
    type: 'income',
    group: 'Receitas Operacionais',
  },
  {
    description: 'Recebimento de consultoria financeira',
    type: 'income',
    group: 'Receitas Operacionais',
  },
  {
    description: 'Receita de regularização fiscal/tributária',
    type: 'income',
    group: 'Receitas Operacionais',
  },
  {
    description: 'Receita de abertura/alteração de empresa',
    type: 'income',
    group: 'Receitas Operacionais',
  },
  { description: 'Reembolso', type: 'income', group: 'Movimentações Financeiras' },
  {
    description: 'Transferência recebida',
    type: 'income',
    group: 'Movimentações Financeiras',
  },
  {
    description: 'Resgate de aplicação financeira',
    type: 'income',
    group: 'Movimentações Financeiras',
  },
  { description: 'Empréstimo recebido', type: 'income', group: 'Movimentações Financeiras' },
  { description: 'Juros recebidos', type: 'income', group: 'Movimentações Financeiras' },
  { description: 'Aluguel', type: 'expense', group: 'Despesas Operacionais' },
  { description: 'Internet', type: 'expense', group: 'Despesas Operacionais' },
  {
    description: 'Pagamento de pró-labore',
    type: 'expense',
    group: 'Despesas Operacionais',
  },
  {
    description: 'Pagamento de salários',
    type: 'expense',
    group: 'Despesas Operacionais',
  },
  {
    description: 'Pagamento de comissões (equipe/vendas)',
    type: 'expense',
    group: 'Despesas Operacionais',
  },
  {
    description: 'Encargos trabalhistas (INSS/FGTS)',
    type: 'expense',
    group: 'Despesas Operacionais',
  },
  { description: 'Aluguel comercial', type: 'expense', group: 'Despesas Operacionais' },
  { description: 'Energia elétrica', type: 'expense', group: 'Despesas Operacionais' },
  { description: 'Internet e telefonia', type: 'expense', group: 'Despesas Operacionais' },
  {
    description: 'Sistemas e softwares (licenças)',
    type: 'expense',
    group: 'Despesas Operacionais',
  },
  {
    description: 'Marketing e tráfego pago',
    type: 'expense',
    group: 'Despesas Operacionais',
  },
  {
    description: 'Material de escritório',
    type: 'expense',
    group: 'Despesas Operacionais',
  },
  { description: 'Serviços de terceiros', type: 'expense', group: 'Despesas Operacionais' },
  { description: 'Honorários jurídicos', type: 'expense', group: 'Despesas Operacionais' },
  { description: 'Taxas bancárias', type: 'expense', group: 'Despesas Administrativas' },
  {
    description: 'Tarifas de boletos/PIX/cartão',
    type: 'expense',
    group: 'Despesas Administrativas',
  },
  {
    description: 'Despesas com cartório',
    type: 'expense',
    group: 'Despesas Administrativas',
  },
  {
    description: 'Despesas com transporte/combustível',
    type: 'expense',
    group: 'Despesas Administrativas',
  },
  {
    description: 'Manutenção de equipamentos',
    type: 'expense',
    group: 'Despesas Administrativas',
  },
  {
    description: 'Assinaturas (ferramentas digitais)',
    type: 'expense',
    group: 'Despesas Administrativas',
  },
  {
    description: 'Despesas com treinamentos',
    type: 'expense',
    group: 'Despesas Administrativas',
  },
  { description: 'Pagamento Simples Nacional', type: 'expense', group: 'Despesas Tributárias' },
  { description: 'Pagamento ISS', type: 'expense', group: 'Despesas Tributárias' },
  { description: 'Pagamento IRPJ', type: 'expense', group: 'Despesas Tributárias' },
  { description: 'Pagamento CSLL', type: 'expense', group: 'Despesas Tributárias' },
  { description: 'Pagamento PIS', type: 'expense', group: 'Despesas Tributárias' },
  { description: 'Pagamento COFINS', type: 'expense', group: 'Despesas Tributárias' },
  { description: 'Pagamento INSS (empresa)', type: 'expense', group: 'Despesas Tributárias' },
  { description: 'Pagamento FGTS', type: 'expense', group: 'Despesas Tributárias' },
  {
    description: 'Multas e juros tributários',
    type: 'expense',
    group: 'Despesas Tributárias',
  },
  {
    description: 'Pagamento de fornecedor',
    type: 'expense',
    group: 'Movimentações Financeiras',
  },
  {
    description: 'Transferência entre contas',
    type: 'expense',
    group: 'Movimentações Financeiras',
  },
  { description: 'Aplicação financeira', type: 'expense', group: 'Movimentações Financeiras' },
  { description: 'Aporte de sócios', type: 'expense', group: 'Movimentações Financeiras' },
  { description: 'Pagamento de empréstimo', type: 'expense', group: 'Movimentações Financeiras' },
  {
    description: 'Juros sobre empréstimos',
    type: 'expense',
    group: 'Movimentações Financeiras',
  },
  {
    description: 'Distribuição de lucros',
    type: 'profit_distribution',
    group: 'Distribuição de Lucros',
  },
  {
    description: 'Retirada de lucros/dividendos',
    type: 'profit_distribution',
    group: 'Distribuição de Lucros',
  },
];

const buildPresetId = (description: string, type: FinanceHistoryType) =>
  `preset:${type}:${description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;

export const FINANCE_HISTORY_PRESETS: FinanceHistoryPreset[] = FINANCE_PRESET_DEFINITIONS.map(
  ({ description, type, group }) => ({
    id: buildPresetId(description, type),
    description,
    type,
    group,
  })
);

export const getFinancePresetDescriptions = (type: FinanceHistoryType): string[] =>
  FINANCE_HISTORY_PRESETS.filter((preset) => preset.type === type).map((preset) => preset.description);

export const mergeFinancePresetDescriptions = (...collections: string[][]): string[] => {
  const merged: string[] = [];
  const seen = new Set<string>();

  collections.forEach((collection) => {
    collection.forEach((value) => {
      const normalized = value.trim();
      if (!normalized) return;
      const key = normalized.toLocaleLowerCase('pt-BR');
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(normalized);
    });
  });

  return merged;
};
