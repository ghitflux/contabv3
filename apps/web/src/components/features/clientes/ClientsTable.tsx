'use client';

import { useMemo } from 'react';
import { Chip } from '@/heroui';
import { getRegimeLabel, type ClientListItem, type ClientStatus } from '@/types/client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { SnippetCopy } from '@/components/ui/SnippetCopy';

interface ClientsTableProps {
  clients: ClientListItem[];
  isLoading?: boolean;
}

const statusColorMap: Record<ClientStatus, 'success' | 'warning' | 'default'> = {
  ativo: 'success',
  pendente: 'warning',
  inativo: 'default',
};

const statusLabelMap: Record<ClientStatus, string> = {
  ativo: 'Ativo',
  pendente: 'Pendente',
  inativo: 'Inativo',
};

export function ClientsTable({ clients, isLoading = false }: ClientsTableProps) {
  const columns = useMemo<Column<ClientListItem>[]>(
    () => [
      {
        key: 'razao_social',
        label: 'Razão Social',
        sortable: true,
      },
      {
        key: 'cnpj',
        label: 'CNPJ',
        render: (client) => <SnippetCopy text={client.cnpj} />,
      },
      {
        key: 'cpf_empresa',
        label: 'CPF',
        render: (client) =>
          client.cpf_empresa ? <SnippetCopy text={client.cpf_empresa} /> : <span className="text-default-400">-</span>,
      },
      {
        key: 'codigo_simples',
        label: 'Código do Simples',
        render: (client) =>
          client.codigo_simples ? <SnippetCopy text={client.codigo_simples} /> : <span className="text-default-400">-</span>,
      },
      {
        key: 'senha_gov',
        label: 'Senha GOV',
        render: (client) =>
          client.senha_gov ? <SnippetCopy text={client.senha_gov} hideByDefault /> : <span className="text-default-400">-</span>,
      },
      {
        key: 'senha_prefeitura',
        label: 'Senha da Prefeitura',
        render: (client) =>
          client.senha_prefeitura ? (
            <SnippetCopy text={client.senha_prefeitura} hideByDefault />
          ) : (
            <span className="text-default-400">-</span>
          ),
      },
      {
        key: 'regime_tributario',
        label: 'Regime de Tributação',
        render: (client) => getRegimeLabel(client.regime_tributario),
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (client) => (
          <Chip color={statusColorMap[client.status]} size="sm" variant="flat">
            {statusLabelMap[client.status]}
          </Chip>
        ),
      },
    ],
    []
  );

  return (
    <div className="w-full overflow-x-auto">
      <DataTable
        columns={columns}
        data={clients}
        isLoading={isLoading}
        getRowKey={(client) => client.id}
        emptyContent="Nenhum cliente encontrado"
      />
    </div>
  );
}
