'use client';

import { useMemo } from 'react';
import { Chip } from '@/heroui';
import type { ClientListItem, ClientStatus } from '@/types/client';
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
        key: 'senha_gov',
        label: 'Senha GOV',
        render: (client) =>
          client.senha_gov ? <SnippetCopy text={client.senha_gov} hideByDefault /> : <span className="text-default-400">-</span>,
      },
      {
        key: 'login_seg_desemp',
        label: 'Login Seg. Desemprego',
        render: (client) =>
          client.login_seg_desemp ? <SnippetCopy text={client.login_seg_desemp} /> : <span className="text-default-400">-</span>,
      },
      {
        key: 'senha_seg_desemp',
        label: 'Senha Seg. Desemprego',
        render: (client) =>
          client.senha_seg_desemp ? <SnippetCopy text={client.senha_seg_desemp} hideByDefault /> : <span className="text-default-400">-</span>,
      },
      {
        key: 'email_seg_desemp',
        label: 'E-mail Seg. Desemprego',
        render: (client) =>
          client.email_seg_desemp ? <SnippetCopy text={client.email_seg_desemp} /> : <span className="text-default-400">-</span>,
      },
      {
        key: 'senha_nfse',
        label: 'Senha NFS-e',
        render: (client) =>
          client.senha_nfse ? <SnippetCopy text={client.senha_nfse} hideByDefault /> : <span className="text-default-400">-</span>,
      },
      {
        key: 'senha_certificado_digital',
        label: 'Senha Cert. Digital',
        render: (client) =>
          client.senha_certificado_digital ? <SnippetCopy text={client.senha_certificado_digital} hideByDefault /> : <span className="text-default-400">-</span>,
      },
      {
        key: 'email',
        label: 'Email',
        render: (client) => <SnippetCopy text={client.email} />,
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
      {
        key: 'honorarios_mensais',
        label: 'Honorários',
        sortable: true,
        render: (client) => (
          <span className="font-medium">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(client.honorarios_mensais)}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      data={clients}
      isLoading={isLoading}
      getRowKey={(client) => client.id}
      emptyContent="Nenhum cliente encontrado"
    />
  );
}
