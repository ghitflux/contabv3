/**
 * Plano de Contas - Livro Caixa Financeiro
 * Sistema de categorização de lançamentos financeiros
 */

export interface ContaCategoria {
  codigo: string;
  nome: string;
  tipo: "RECEITA" | "DESPESA" | "CUSTO" | "INVESTIMENTO";
  descricao?: string;
}

export const PLANO_DE_CONTAS: ContaCategoria[] = [
  // 🔹 1. RECEITAS
  // 1.1 Receitas Operacionais
  {
    codigo: "1.1.01",
    nome: "Venda de Produtos",
    tipo: "RECEITA",
    descricao: "Receita com venda de produtos",
  },
  {
    codigo: "1.1.02",
    nome: "Prestação de Serviços",
    tipo: "RECEITA",
    descricao: "Receita com prestação de serviços",
  },
  {
    codigo: "1.1.03",
    nome: "Comissões Recebidas",
    tipo: "RECEITA",
    descricao: "Comissões e bonificações recebidas",
  },
  {
    codigo: "1.1.04",
    nome: "Honorários / Mensalidades",
    tipo: "RECEITA",
    descricao: "Honorários contábeis e mensalidades de clientes",
  },

  // 1.2 Receitas Não Operacionais
  {
    codigo: "1.2.01",
    nome: "Juros Recebidos",
    tipo: "RECEITA",
    descricao: "Juros recebidos de aplicações ou atrasos",
  },
  {
    codigo: "1.2.02",
    nome: "Rendimentos Financeiros",
    tipo: "RECEITA",
    descricao: "Rendimentos de investimentos e aplicações",
  },
  {
    codigo: "1.2.03",
    nome: "Venda de Ativo / Bens",
    tipo: "RECEITA",
    descricao: "Venda de ativos fixos e bens patrimoniais",
  },
  {
    codigo: "1.2.04",
    nome: "Outras Receitas",
    tipo: "RECEITA",
    descricao: "Outras receitas não classificadas",
  },
  {
    codigo: "1.2.05",
    nome: "Recuperação de Tributos",
    tipo: "RECEITA",
    descricao: "Restituições, compensações e créditos tributários",
  },

  // 🔹 2. DESPESAS
  // 2.1 Despesas Administrativas
  {
    codigo: "2.1.01",
    nome: "Aluguel",
    tipo: "DESPESA",
    descricao: "Aluguel de imóveis e espaços",
  },
  {
    codigo: "2.1.02",
    nome: "Água",
    tipo: "DESPESA",
    descricao: "Conta de água",
  },
  {
    codigo: "2.1.03",
    nome: "Energia Elétrica",
    tipo: "DESPESA",
    descricao: "Conta de energia elétrica",
  },
  {
    codigo: "2.1.04",
    nome: "Internet / Telefonia",
    tipo: "DESPESA",
    descricao: "Serviços de internet e telefonia",
  },
  {
    codigo: "2.1.05",
    nome: "Material de Escritório",
    tipo: "DESPESA",
    descricao: "Materiais de consumo do escritório",
  },
  {
    codigo: "2.1.06",
    nome: "Serviços Contábeis",
    tipo: "DESPESA",
    descricao: "Serviços contábeis externos",
  },
  {
    codigo: "2.1.07",
    nome: "Serviços Jurídicos",
    tipo: "DESPESA",
    descricao: "Honorários advocatícios e jurídicos",
  },
  {
    codigo: "2.1.08",
    nome: "Softwares e Sistemas",
    tipo: "DESPESA",
    descricao: "Licenças de software e sistemas",
  },
  {
    codigo: "2.1.09",
    nome: "Taxas Bancárias",
    tipo: "DESPESA",
    descricao: "Tarifas e taxas bancárias",
  },
  {
    codigo: "2.1.10",
    nome: "Serviços prestados PF",
    tipo: "DESPESA",
    descricao: "Pagamento a pessoa física",
  },
  {
    codigo: "2.1.11",
    nome: "Serviços prestados PJ",
    tipo: "DESPESA",
    descricao: "Pagamento a pessoa jurídica",
  },

  // 2.2 Despesas com Pessoal
  {
    codigo: "2.2.01",
    nome: "Salários",
    tipo: "DESPESA",
    descricao: "Folha de pagamento de funcionários",
  },
  {
    codigo: "2.2.02",
    nome: "Pró-labore",
    tipo: "DESPESA",
    descricao: "Retirada de sócios",
  },
  {
    codigo: "2.2.03",
    nome: "INSS",
    tipo: "DESPESA",
    descricao: "Contribuição previdenciária",
  },
  {
    codigo: "2.2.04",
    nome: "FGTS",
    tipo: "DESPESA",
    descricao: "Fundo de Garantia por Tempo de Serviço",
  },
  {
    codigo: "2.2.05",
    nome: "Benefícios (VA, VT, etc.)",
    tipo: "DESPESA",
    descricao: "Vale alimentação, transporte e outros benefícios",
  },

  // 2.3 Despesas Comerciais
  {
    codigo: "2.3.01",
    nome: "Marketing e Publicidade",
    tipo: "DESPESA",
    descricao: "Despesas com marketing e propaganda",
  },
  {
    codigo: "2.3.02",
    nome: "Tráfego Pago",
    tipo: "DESPESA",
    descricao: "Anúncios online (Google Ads, Facebook Ads, etc.)",
  },
  {
    codigo: "2.3.03",
    nome: "Comissões Pagas",
    tipo: "DESPESA",
    descricao: "Comissões de vendedores e representantes",
  },
  {
    codigo: "2.3.04",
    nome: "Eventos e Promoções",
    tipo: "DESPESA",
    descricao: "Eventos, feiras e ações promocionais",
  },

  // 2.4 Despesas Financeiras
  {
    codigo: "2.4.01",
    nome: "Juros Bancários",
    tipo: "DESPESA",
    descricao: "Juros de empréstimos e financiamentos",
  },
  {
    codigo: "2.4.02",
    nome: "Multas e Encargos",
    tipo: "DESPESA",
    descricao: "Multas por atraso e outros encargos",
  },
  {
    codigo: "2.4.03",
    nome: "IOF",
    tipo: "DESPESA",
    descricao: "Imposto sobre Operações Financeiras",
  },

  // 2.5 Tributos e Impostos
  {
    codigo: "2.5.01",
    nome: "Simples Nacional (DAS)",
    tipo: "DESPESA",
    descricao: "Documento de Arrecadação do Simples Nacional",
  },
  {
    codigo: "2.5.02",
    nome: "IRPJ",
    tipo: "DESPESA",
    descricao: "Imposto de Renda Pessoa Jurídica",
  },
  {
    codigo: "2.5.03",
    nome: "CSLL",
    tipo: "DESPESA",
    descricao: "Contribuição Social sobre Lucro Líquido",
  },
  {
    codigo: "2.5.04",
    nome: "PIS",
    tipo: "DESPESA",
    descricao: "Programa de Integração Social",
  },
  {
    codigo: "2.5.05",
    nome: "COFINS",
    tipo: "DESPESA",
    descricao: "Contribuição para Financiamento da Seguridade Social",
  },
  {
    codigo: "2.5.06",
    nome: "ISS",
    tipo: "DESPESA",
    descricao: "Imposto Sobre Serviços",
  },
  {
    codigo: "2.5.07",
    nome: "ICMS",
    tipo: "DESPESA",
    descricao: "Imposto sobre Circulação de Mercadorias e Serviços",
  },
  {
    codigo: "2.5.08",
    nome: "ICMS ST",
    tipo: "DESPESA",
    descricao: "ICMS Substituição Tributária",
  },
  {
    codigo: "2.5.09",
    nome: "IPI",
    tipo: "DESPESA",
    descricao: "Imposto sobre Produtos Industrializados",
  },
  {
    codigo: "2.5.10",
    nome: "IRRF",
    tipo: "DESPESA",
    descricao: "Imposto de Renda Retido na Fonte",
  },
  {
    codigo: "2.5.11",
    nome: "INSS Patronal",
    tipo: "DESPESA",
    descricao: "Contribuição previdenciária patronal",
  },
  {
    codigo: "2.5.12",
    nome: "Contribuição Previdenciária (CPP)",
    tipo: "DESPESA",
    descricao: "Contribuição Previdenciária Patronal do Simples",
  },
  {
    codigo: "2.5.13",
    nome: "DARF / GPS / DAE",
    tipo: "DESPESA",
    descricao: "Guias federais e previdenciárias",
  },
  {
    codigo: "2.5.14",
    nome: "Taxas Municipais e Alvarás",
    tipo: "DESPESA",
    descricao: "Taxas de fiscalização, funcionamento e alvarás",
  },
  {
    codigo: "2.5.15",
    nome: "Taxas Estaduais",
    tipo: "DESPESA",
    descricao: "Taxas e guias estaduais (ex: GARE)",
  },
  {
    codigo: "2.5.16",
    nome: "Taxas Federais",
    tipo: "DESPESA",
    descricao: "Taxas e guias federais complementares",
  },
  {
    codigo: "2.5.17",
    nome: "IPTU / IPVA",
    tipo: "DESPESA",
    descricao: "Impostos patrimoniais e veiculares",
  },
  {
    codigo: "2.5.99",
    nome: "Outros Impostos e Tributos",
    tipo: "DESPESA",
    descricao: "Demais impostos, contribuições e taxas",
  },

  // 🔹 3. CUSTOS
  {
    codigo: "3.1.01",
    nome: "Mão de obra",
    tipo: "CUSTO",
    descricao: "Custo direto com mão de obra",
  },
  {
    codigo: "3.1.02",
    nome: "Matéria-prima",
    tipo: "CUSTO",
    descricao: "Custo com matéria-prima",
  },
  {
    codigo: "3.1.03",
    nome: "Insumos",
    tipo: "CUSTO",
    descricao: "Insumos de produção",
  },
  {
    codigo: "3.1.04",
    nome: "Custo de Mercadorias Vendidas (CMV)",
    tipo: "CUSTO",
    descricao: "CMV - Custo das mercadorias",
  },
  {
    codigo: "3.1.05",
    nome: "Custo de Serviços Prestados (CSP)",
    tipo: "CUSTO",
    descricao: "CSP - Custo dos serviços",
  },

  // 🔹 4. INVESTIMENTOS
  // 4.1 Investimentos em Ativos
  {
    codigo: "4.1.01",
    nome: "Máquinas e Equipamentos",
    tipo: "INVESTIMENTO",
    descricao: "Aquisição de máquinas e equipamentos",
  },
  {
    codigo: "4.1.02",
    nome: "Móveis e Utensílios",
    tipo: "INVESTIMENTO",
    descricao: "Compra de móveis e utensílios",
  },
  {
    codigo: "4.1.03",
    nome: "Veículos",
    tipo: "INVESTIMENTO",
    descricao: "Aquisição de veículos",
  },
  {
    codigo: "4.1.04",
    nome: "Imóveis / Terrenos",
    tipo: "INVESTIMENTO",
    descricao: "Compra de imóveis e terrenos",
  },

  // 4.2 Investimentos Financeiros
  {
    codigo: "4.2.01",
    nome: "Aplicações Financeiras",
    tipo: "INVESTIMENTO",
    descricao: "Aplicações em renda fixa ou variável",
  },
  {
    codigo: "4.2.02",
    nome: "CDB / Fundos",
    tipo: "INVESTIMENTO",
    descricao: "Certificados de Depósito Bancário e Fundos",
  },
  {
    codigo: "4.2.03",
    nome: "Participações Societárias",
    tipo: "INVESTIMENTO",
    descricao: "Investimento em participação societária",
  },
];

/**
 * Helper function to get options for autocomplete grouped by type
 */
export function getPlanoDeContasGrouped() {
  const groups = {
    RECEITA: [] as ContaCategoria[],
    DESPESA: [] as ContaCategoria[],
    CUSTO: [] as ContaCategoria[],
    INVESTIMENTO: [] as ContaCategoria[],
  };

  for (const conta of PLANO_DE_CONTAS) {
    groups[conta.tipo].push(conta);
  }

  return groups;
}

/**
 * Helper function to format conta for display
 */
export function formatConta(conta: ContaCategoria): string {
  return `${conta.codigo} - ${conta.nome}`;
}

/**
 * Helper function to search contas
 */
export function searchContas(query: string): ContaCategoria[] {
  const lowerQuery = query.toLowerCase();
  return PLANO_DE_CONTAS.filter(
    (conta) =>
      conta.codigo.includes(lowerQuery) ||
      conta.nome.toLowerCase().includes(lowerQuery) ||
      conta.descricao?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Helper function to get conta by codigo
 */
export function getContaByCodigo(codigo: string): ContaCategoria | undefined {
  return PLANO_DE_CONTAS.find((conta) => conta.codigo === codigo);
}

export function isPlanoContaCodigo(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value.trim());
}

const TAX_CATEGORY_REGEX =
  /(imposto|tribut|taxa|das|darf|gare|dae|gps|inss|fgts|irpj|csll|pis|cofins|icms|iss|ipi|iof|irrf|iptu|ipva)/i;

export function isTaxCategoryName(value: string): boolean {
  return TAX_CATEGORY_REGEX.test(value);
}

export type ResolvedCategoriaLancamento = {
  value: string;
  label: string;
  isCustom: boolean;
  isTax: boolean;
  conta?: ContaCategoria;
};

export function resolveCategoriaLancamento(
  rawValue: string | null | undefined
): ResolvedCategoriaLancamento | null {
  if (!rawValue) return null;
  const value = rawValue.trim();
  if (!value) return null;

  const conta = getContaByCodigo(value);
  if (conta) {
    const taxText = `${conta.nome} ${conta.descricao ?? ""}`;
    return {
      value,
      label: formatConta(conta),
      isCustom: false,
      isTax: isTaxCategoryName(taxText),
      conta,
    };
  }

  const customLabel = value.toLowerCase().startsWith("custom:")
    ? value.slice("custom:".length).trim()
    : value;

  return {
    value,
    label: customLabel || value,
    isCustom: true,
    isTax: isTaxCategoryName(customLabel || value),
  };
}

/**
 * Get group label
 */
export function getGroupLabel(tipo: ContaCategoria["tipo"]): string {
  const labels = {
    RECEITA: "💰 Receitas",
    DESPESA: "📊 Despesas",
    CUSTO: "🏭 Custos",
    INVESTIMENTO: "📈 Investimentos",
  };
  return labels[tipo];
}
